create extension if not exists pgcrypto;

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  username text not null unique,
  name text not null,
  password_hash text not null,
  role text not null default 'kasir' check (role in ('kasir','admin')),
  active boolean not null default true
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text,
  price integer not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table product_plu (
  plu text primary key,
  product_id uuid not null references products(id) on delete cascade
);

create index on product_plu (product_id);

create table store_stock (
  store_id uuid not null references stores(id),
  product_id uuid not null references products(id) on delete cascade,
  qty integer not null default 0 check (qty >= 0),
  primary key (store_id, product_id)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  staff_id uuid not null references staff(id),
  invoice_no text not null unique,
  total integer not null default 0,
  paid integer not null default 0,
  change_amount integer not null default 0,
  method text not null check (method in ('cash','qris','debit')),
  created_at timestamptz not null default now()
);

create table transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  product_id uuid not null references products(id),
  sku text not null,
  name text not null,
  price integer not null,
  qty integer not null check (qty > 0),
  subtotal integer not null
);

create index on transactions (store_id, created_at desc);
create index on transaction_items (transaction_id);
create index on products (lower(name));

alter table stores enable row level security;
alter table staff enable row level security;
alter table products enable row level security;
alter table product_plu enable row level security;
alter table store_stock enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;

create or replace function create_sale(
  p_store uuid, p_staff uuid, p_method text, p_paid integer, p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_total integer := 0;
  v_inv text;
  it jsonb;
  v_prod products%rowtype;
  v_qty integer;
  v_stock integer;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang kosong';
  end if;

  v_inv := 'INV' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDDHH24MISS')
           || lpad((floor(random() * 1000))::int::text, 3, '0');

  insert into transactions (id, store_id, staff_id, invoice_no, method)
  values (v_id, p_store, p_staff, v_inv, p_method);

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::integer;
    select * into v_prod from products where sku = (it->>'sku') and active;
    if not found then
      raise exception 'Produk % tidak ditemukan', it->>'sku';
    end if;
    if v_prod.price <= 0 then
      raise exception 'Harga % belum diisi', v_prod.name;
    end if;

    select qty into v_stock from store_stock
    where store_id = p_store and product_id = v_prod.id for update;
    if found then
      if v_stock < v_qty then
        raise exception 'Stok % tidak cukup', v_prod.name;
      end if;
      update store_stock set qty = qty - v_qty
      where store_id = p_store and product_id = v_prod.id;
    end if;

    insert into transaction_items (transaction_id, product_id, sku, name, price, qty, subtotal)
    values (v_id, v_prod.id, v_prod.sku, v_prod.name, v_prod.price, v_qty, v_prod.price * v_qty);

    v_total := v_total + v_prod.price * v_qty;
  end loop;

  if p_method = 'cash' and p_paid < v_total then
    raise exception 'Uang bayar kurang';
  end if;
  if p_method <> 'cash' then
    p_paid := v_total;
  end if;

  update transactions
  set total = v_total, paid = p_paid, change_amount = p_paid - v_total
  where id = v_id;

  return v_id;
end;
$$;

revoke all on function create_sale(uuid, uuid, text, integer, jsonb) from public, anon, authenticated;

insert into stores (name) values
  ('Rambay'), ('Lingkar Selatan'), ('Cisaat 1'), ('Cisaat 2'), ('Cisaat 3'), ('Bojong Sampora');
