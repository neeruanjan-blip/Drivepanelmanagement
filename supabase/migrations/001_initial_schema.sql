-- =============================================
-- Drive & Panel Management App - Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- DOMAINS TABLE
-- =============================================
CREATE TABLE domains (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROFILES TABLE (extends auth.users)
-- =============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('admin', 'recruiter', 'panel')) DEFAULT 'recruiter',
  domain_id UUID REFERENCES domains(id),
  designation TEXT,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PANEL MEMBERS TABLE
-- =============================================
CREATE TABLE panel_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  designation TEXT,
  interview_level TEXT CHECK (interview_level IN ('L1','L2','Managerial','HR')),
  hiring_role TEXT,
  location TEXT,
  availability TEXT CHECK (availability IN ('Available','Unavailable','On Leave')) DEFAULT 'Available',
  availability_updated_at TIMESTAMPTZ,
  availability_token TEXT UNIQUE DEFAULT uuid_generate_v4()::TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DRIVE SHEETS TABLE
-- =============================================
CREATE TABLE drive_sheets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE NOT NULL,
  drive_name TEXT NOT NULL,
  drive_date DATE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CANDIDATES TABLE
-- =============================================
CREATE TABLE candidates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  drive_sheet_id UUID REFERENCES drive_sheets(id) ON DELETE CASCADE NOT NULL,
  domain_id UUID REFERENCES domains(id) NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact TEXT,
  experience_years NUMERIC(4,1),
  current_company TEXT,
  notice_period TEXT,
  recruiter_name TEXT,
  interview_level TEXT CHECK (interview_level IN ('L1','L2','Managerial','HR')),
  status TEXT CHECK (status IN (
    'Scheduled','Confirmed','No Show',
    'L1 Cleared','L1 Rejected',
    'L2 Cleared','L2 Rejected',
    'Managerial Cleared','HR Round',
    'Selected','Rejected','Offer Released'
  )) DEFAULT 'Scheduled',
  panel_member_id UUID REFERENCES panel_members(id),
  interview_link TEXT,
  interview_date TIMESTAMPTZ,
  confirmation_token TEXT UNIQUE DEFAULT uuid_generate_v4()::TEXT,
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EMAIL LOGS TABLE
-- =============================================
CREATE TABLE email_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT,
  type TEXT,
  status TEXT CHECK (status IN ('sent','failed','pending')) DEFAULT 'pending',
  metadata JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_domains_updated BEFORE UPDATE ON domains FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_panel_updated BEFORE UPDATE ON panel_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_drive_updated BEFORE UPDATE ON drive_sheets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can see their own, admins can see all
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Domains: all authenticated users can read, only admins write
CREATE POLICY "domains_select" ON domains FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "domains_insert" ON domains FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "domains_update" ON domains FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "domains_delete" ON domains FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Panel members: authenticated users can read, admin/recruiter can write
CREATE POLICY "panel_select" ON panel_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "panel_insert" ON panel_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "panel_update" ON panel_members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "panel_delete" ON panel_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','recruiter'))
);

-- Drive sheets & candidates: authenticated users
CREATE POLICY "drive_select" ON drive_sheets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "drive_insert" ON drive_sheets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "drive_update" ON drive_sheets FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "drive_delete" ON drive_sheets FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "candidates_select" ON candidates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "candidates_insert" ON candidates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "candidates_update" ON candidates FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "candidates_delete" ON candidates FOR DELETE USING (auth.role() = 'authenticated');

-- Notifications: users see their own
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Email logs: admin only
CREATE POLICY "email_logs_select" ON email_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- USEFUL VIEWS
-- =============================================
CREATE OR REPLACE VIEW candidate_summary AS
SELECT
  c.id, c.name, c.email, c.status, c.interview_level,
  c.experience_years, c.current_company, c.notice_period,
  c.recruiter_name, c.interview_date, c.interview_link,
  c.created_at, c.domain_id,
  pm.name AS panel_name, pm.email AS panel_email,
  ds.drive_name, ds.drive_date,
  d.name AS domain_name
FROM candidates c
LEFT JOIN panel_members pm ON c.panel_member_id = pm.id
LEFT JOIN drive_sheets ds ON c.drive_sheet_id = ds.id
LEFT JOIN domains d ON c.domain_id = d.id;

-- =============================================
-- SAMPLE SEED DATA (optional)
-- =============================================
-- INSERT INTO domains (name, description) VALUES
--   ('Engineering', 'Software Engineering domain'),
--   ('Design', 'Product Design domain'),
--   ('Data Science', 'Data & Analytics domain');
