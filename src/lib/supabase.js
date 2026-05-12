// src/lib/supabase.js
// Supabase client - loaded via CDN, no npm install needed

// !! Replace with your actual Supabase project URL and anon key !!
// Found in: Supabase Dashboard > Project Settings > API
const SUPABASE_URL = window.__ENV?.SUPABASE_URL || "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = window.__ENV?.SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

// Initialize via CDN (loaded in index.html)
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
// AUTH HELPERS
// =============================================
export const auth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
    window.location.hash = "#/login";
  },

  async getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    return { ...user, profile };
  },

  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// =============================================
// DOMAIN API
// =============================================
export const domainApi = {
  async list() {
    const { data, error } = await supabase.from("domains").select("*").order("name");
    if (error) throw error;
    return data;
  },
  async create(payload) {
    const { data, error } = await supabase.from("domains").insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    const { data, error } = await supabase.from("domains").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from("domains").delete().eq("id", id);
    if (error) throw error;
  }
};

// =============================================
// PANEL MEMBER API
// =============================================
export const panelApi = {
  async list(domainId) {
    let q = supabase.from("panel_members").select("*, domains(name)").order("name");
    if (domainId) q = q.eq("domain_id", domainId);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(payload) {
    const { data, error } = await supabase.from("panel_members").insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    const { data, error } = await supabase.from("panel_members").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from("panel_members").update({ is_active: false }).eq("id", id);
    if (error) throw error;
  }
};

// =============================================
// DRIVE SHEET API
// =============================================
export const driveApi = {
  async list(domainId) {
    let q = supabase.from("drive_sheets").select("*, domains(name)").order("created_at", { ascending: false });
    if (domainId) q = q.eq("domain_id", domainId);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(payload) {
    const { data, error } = await supabase.from("drive_sheets").insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    const { data, error } = await supabase.from("drive_sheets").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from("drive_sheets").delete().eq("id", id);
    if (error) throw error;
  }
};

// =============================================
// CANDIDATE API
// =============================================
export const candidateApi = {
  async list(driveSheetId, filters = {}) {
    let q = supabase
      .from("candidate_summary")
      .select("*")
      .order("created_at", { ascending: false });
    if (driveSheetId) q = q.eq("drive_sheet_id", driveSheetId);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.domainId) q = q.eq("domain_id", filters.domainId);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async create(payload) {
    const { data, error } = await supabase.from("candidates").insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    const { data, error } = await supabase.from("candidates").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) throw error;
  },
  async sendConfirmationEmail(candidateId) {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { type: "candidate_confirmation", payload: { candidateId } }
    });
    if (error) throw error;
    return data;
  }
};

// =============================================
// NOTIFICATIONS API
// =============================================
export const notificationApi = {
  async list(userId) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data;
  },
  async markRead(id) {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) throw error;
  },
  subscribe(userId, callback) {
    return supabase
      .channel("notifications")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  }
};

// =============================================
// DASHBOARD / REPORTS API
// =============================================
export const reportApi = {
  async getDashboardStats(domainId) {
    let filter = domainId ? `domain_id=eq.${domainId}` : null;
    const [candidatesRes, panelRes] = await Promise.all([
      supabase.from("candidates").select("status, interview_level, domain_id"),
      supabase.from("panel_members").select("availability, domain_id"),
    ]);
    const candidates = candidatesRes.data || [];
    const panels = panelRes.data || [];
    const filtered = domainId ? candidates.filter(c => c.domain_id === domainId) : candidates;
    const pFiltered = domainId ? panels.filter(p => p.domain_id === domainId) : panels;

    const statusCounts = filtered.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});

    return {
      total: filtered.length,
      selected: statusCounts["Selected"] || 0,
      rejected: statusCounts["Rejected"] || 0,
      confirmed: statusCounts["Confirmed"] || 0,
      noShow: statusCounts["No Show"] || 0,
      offerReleased: statusCounts["Offer Released"] || 0,
      availablePanels: pFiltered.filter(p => p.availability === "Available").length,
      totalPanels: pFiltered.length,
      statusCounts,
    };
  }
};
