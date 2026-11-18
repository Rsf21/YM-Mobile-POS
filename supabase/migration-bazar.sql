create table bazaars (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  opened_by uuid not null references staff(id),
  name text not null,
  status text not null default 'open' check (status in ('open','closed')),
  opening_cash integer not null default 0 check (opening_cash >= 0),
  closing_cash integer,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table bazaar_items (
  bazaar_id uuid not null references bazaars(id) on delete cascade,
  product_id uuid not null references products(id),
  price integer not null check (price > 0),
  qty_brought integer not null default 0 check (qty_brought >= 0),
  qty_sold integer not null default 0 check (qty_sold >= 0),
  primary key (bazaar_id, product_id)
);

alter table transactions add column bazaar_id uuid references bazaars(id);

create index on transactions (bazaar_id);
create index on bazaars (store_id, status);

alter table bazaars enable row level security;
alter table bazaar_items enable row level security;

create or replace function create_bazaar_sale(
  p_bazaar uuid, p_store uuid, p_staff uuid, p_method text, p_paid integer, p_items jsonb
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
  v_item bazaar_items%rowtype;
  v_qty integer;
begin
  perform 1 from bazaars where id = p_bazaar and store_id = p_store and status = 'open';
  if not found then
    raise exception 'Bazar tidak aktif';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang kosong';
  end if;

  v_inv := 'INV' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDDHH24MISS')
           || lpad((floor(random() * 1000))::int::text, 3, '0');

  insert into transactions (id, store_id, staff_id, invoice_no, method, bazaar_id)
  values (v_id, p_store, p_staff, v_inv, p_method, p_bazaar);

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::integer;
    select * into v_prod from products where sku = (it->>'sku');
    if not found then
      raise exception 'Produk % tidak ditemukan', it->>'sku';
    end if;

    select * into v_item from bazaar_items
    where bazaar_id = p_bazaar and product_id = v_prod.id for update;
    if not found then
      raise exception '% belum ada di daftar bazar', v_prod.name;
    end if;
    if v_item.qty_brought - v_item.qty_sold < v_qty then
      raise exception 'Sisa % tidak cukup', v_prod.name;
    end if;

    update bazaar_items set qty_sold = qty_sold + v_qty
    where bazaar_id = p_bazaar and product_id = v_prod.id;

    insert into transaction_items (transaction_id, product_id, sku, name, price, qty, subtotal)
    values (v_id, v_prod.id, v_prod.sku, v_prod.name, v_item.price, v_qty, v_item.price * v_qty);

    v_total := v_total + v_item.price * v_qty;
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

create or replace function bazaar_summary(p_bazaar uuid)
returns table (method text, trx integer, total bigint)
language sql
security definer
set search_path = public
as $$
  select t.method, count(*)::integer, coalesce(sum(t.total), 0)::bigint
  from transactions t
  where t.bazaar_id = p_bazaar
  group by t.method;
$$;

revoke all on function create_bazaar_sale(uuid, uuid, uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function bazaar_summary(uuid) from public, anon, authenticated;
