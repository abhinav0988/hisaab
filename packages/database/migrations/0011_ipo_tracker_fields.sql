ALTER TABLE ipo_applications ADD COLUMN market_category text DEFAULT 'Mainboard';
ALTER TABLE ipo_applications ADD COLUMN allotted_amount_minor integer;
ALTER TABLE ipo_applications ADD COLUMN listing_price_minor integer;
ALTER TABLE ipo_applications ADD COLUMN current_price_minor integer;
