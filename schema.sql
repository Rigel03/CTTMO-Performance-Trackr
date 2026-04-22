-- ==============================================================================
-- IPCR APP (PerfMon) - SUPABASE POSTGRESQL SCHEMA
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. PROFILES (Replaces 'users' collection)
-- ==========================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  employee_id UUID, -- Will reference employees(id) once created
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can read their own profile, admins can read all
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update profiles" 
ON public.profiles FOR UPDATE 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete profiles" 
ON public.profiles FOR DELETE 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Automatically create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE((NEW.raw_user_meta_data->>'role'), 'employee'),
    COALESCE((NEW.raw_user_meta_data->>'displayName'), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==========================================
-- 2. EMPLOYEES
-- ==========================================
CREATE TABLE public.employees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT,
  section TEXT,
  division TEXT,
  employment_type TEXT NOT NULL DEFAULT 'plantilla', -- 'plantilla' or 'jo_cos'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Now add FK constraint to profiles
ALTER TABLE public.profiles 
  ADD CONSTRAINT fk_profile_employee 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- RLS: All authenticated users can read, only admins can write
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employees" 
ON public.employees FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert employees" 
ON public.employees FOR INSERT 
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update employees" 
ON public.employees FOR UPDATE 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete employees" 
ON public.employees FOR DELETE 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ==========================================
-- 3. MFO DEFINITIONS
-- ==========================================
CREATE TABLE public.mfo_definitions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category TEXT NOT NULL,
  mfo_name TEXT NOT NULL,
  success_indicator_desc TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.mfo_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view MFOs" ON public.mfo_definitions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert MFOs" ON public.mfo_definitions FOR INSERT WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Admins can update MFOs" ON public.mfo_definitions FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Admins can delete MFOs" ON public.mfo_definitions FOR DELETE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ==========================================
-- 4. MFO ASSIGNMENTS (Join Table)
-- ==========================================
CREATE TABLE public.mfo_assignments (
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  mfo_id UUID REFERENCES public.mfo_definitions(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (employee_id, mfo_id)
);

-- RLS
ALTER TABLE public.mfo_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view assignments" ON public.mfo_assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage assignments" ON public.mfo_assignments FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ==========================================
-- 5. PERFORMANCE RECORDS
-- ==========================================
CREATE TABLE public.performance_records (
  id TEXT PRIMARY KEY, -- deterministic ID: {empId}_{mfoId}_{quarter}_{year}
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  mfo_id UUID REFERENCES public.mfo_definitions(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL,
  year INTEGER NOT NULL,
  target_qty INTEGER DEFAULT 0,
  total_qty INTEGER DEFAULT 0,
  quantity_m1 INTEGER DEFAULT 0,
  quantity_m2 INTEGER DEFAULT 0,
  quantity_m3 INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  admin_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(employee_id, mfo_id, quarter, year)
);

-- RLS: Employees write own, Admins write all
ALTER TABLE public.performance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view records" ON public.performance_records FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Employees can manage own records" ON public.performance_records FOR ALL USING (
  employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);


-- ==========================================
-- 6. PERFORMANCE INDICATORS (For JO/COS)
-- ==========================================
CREATE TABLE public.performance_indicators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  indicator_desc TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.performance_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view indicators" ON public.performance_indicators FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage indicators" ON public.performance_indicators FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ==========================================
-- 7. INDICATOR ASSIGNMENTS (Join Table)
-- ==========================================
CREATE TABLE public.indicator_assignments (
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  indicator_id UUID REFERENCES public.performance_indicators(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (employee_id, indicator_id)
);

-- RLS
ALTER TABLE public.indicator_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view indicator assignments" ON public.indicator_assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage indicator assignments" ON public.indicator_assignments FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ==========================================
-- 8. INDICATOR LOGS
-- ==========================================
CREATE TABLE public.indicator_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  indicator_id UUID REFERENCES public.performance_indicators(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  value NUMERIC DEFAULT 0,
  notes TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.indicator_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view logs" ON public.indicator_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Employees can manage own logs" ON public.indicator_logs FOR ALL USING (
  employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
