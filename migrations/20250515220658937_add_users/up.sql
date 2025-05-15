-- Write your UP migration SQL here
CREATE TABLE testers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  meta JSONB,
  created_at BIGINT,
  updated_at BIGINT
);