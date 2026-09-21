-- ==========================================
-- WAREHOUSE AI DATABASE
-- ==========================================


create table if not exists warehouse_entries (

    id uuid primary key
        default gen_random_uuid(),

    entry_date date
        not null
        default current_date,

    product_name text
        not null,

    quantity numeric
        not null
        default 0,

    unit text
        not null
        default 'pcs',

    reference text
        default '',

    entry_by text
        not null,

    created_at timestamptz
        default now(),

    updated_at timestamptz
        default now()

);


-- INDEX FOR DATE SEARCH

create index if not exists
warehouse_entries_date_idx
on warehouse_entries(entry_date);


-- INDEX FOR PRODUCT SEARCH

create index if not exists
warehouse_entries_product_idx
on warehouse_entries(product_name);
