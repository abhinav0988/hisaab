ALTER TABLE transactions ADD COLUMN credit_facility_id text REFERENCES credit_facilities(id);
