-- Store stable Lucide icon keys for all catalog types. The UI resolves keys
-- through an allow-list and falls back to "tag" for unknown or missing keys.
alter table public.purposes add column if not exists icon text;
alter table public.expense_types add column if not exists icon text;
alter table public.payment_methods add column if not exists icon text;

update public.purposes set icon = case name
  when 'Sinh hoạt gia đình' then 'house'
  when 'Con cái' then 'baby'
  when 'Du lịch' then 'plane'
  when 'Hiếu hỉ & quan hệ' then 'heart-handshake'
  when 'Nhà cửa & gia dụng' then 'house'
  when 'Xe cộ' then 'car'
  when 'Sức khỏe gia đình' then 'heart-pulse'
  when 'Thai sản' then 'baby'
  when 'Đầu tư' then 'trending-up'
  else 'tag'
end where icon is null or trim(icon) = '';

update public.expense_types set icon = case name
  when 'Ăn uống' then 'utensils'
  when 'Thực phẩm' then 'shopping-basket'
  when 'Điện' then 'lightbulb'
  when 'Nước' then 'droplets'
  when 'Internet' then 'wifi'
  when 'Di chuyển' then 'bus'
  when 'Du lịch' then 'plane'
  when 'Xăng' then 'fuel'
  when 'ETC' then 'ticket'
  when 'Khách sạn' then 'hotel'
  when 'Vé máy bay' then 'plane'
  when 'Quần áo' then 'shirt'
  when 'Giày dép' then 'footprints'
  when 'Gia dụng' then 'house'
  when 'Xe cộ' then 'car'
  when 'Giáo dục' then 'graduation-cap'
  when 'Sức khỏe' then 'heart-pulse'
  when 'Sức khoẻ' then 'heart-pulse'
  when 'Mỹ phẩm' then 'sparkles'
  when 'Spa' then 'sparkles'
  when 'Giải trí' then 'gamepad-2'
  when 'Đồ chơi' then 'toy-brick'
  when 'Tiêu dùng' then 'shopping-cart'
  when 'Thú cưng' then 'paw-print'
  when 'Tiền rác' then 'trash-2'
  when 'Đám cưới' then 'heart'
  when 'Sinh nhật' then 'cake-slice'
  when 'Lì xì' then 'gift'
  when 'Sinh con' then 'baby'
  when 'Quà' then 'gift'
  when 'Đầu tư chứng khoán' then 'chart-candlestick'
  when 'Đầu tư vàng' then 'coins'
  when 'Quỹ ứng' then 'wallet'
  else 'tag'
end where icon is null or trim(icon) = '';

update public.payment_methods set icon = case name
  when 'Chuyển khoản' then 'landmark'
  when 'Thẻ tín dụng' then 'credit-card'
  when 'Trả góp' then 'credit-card'
  when 'Urbox' then 'ticket'
  when 'Tiền mặt' then 'banknote'
  else 'tag'
end where icon is null or trim(icon) = '';

create or replace function public.seed_family_defaults(p_family_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  names text[] := array['Sinh hoạt gia đình','Con cái','Du lịch','Hiếu hỉ & quan hệ','Nhà cửa & gia dụng','Xe cộ','Sức khỏe gia đình','Thai sản','Đầu tư','Khác'];
  names_en text[] := array['Family living','Children','Travel','Family occasions & relationships','Home & household','Vehicles','Family health','Maternity','Investments','Other'];
  icons text[] := array['house','baby','plane','heart-handshake','house','car','heart-pulse','baby','trending-up','tag'];
  types text[] := array['Ăn uống','Thực phẩm','Điện','Nước','Internet','Di chuyển','Xăng','ETC','Khách sạn','Vé máy bay','Quần áo','Giày dép','Gia dụng','Giáo dục','Sức khỏe','Mỹ phẩm','Giải trí','Đồ chơi','Tiêu dùng','Thú cưng','Đám cưới','Sinh nhật','Lì xì','Quà','Đầu tư chứng khoán','Đầu tư vàng','Khác'];
  types_en text[] := array['Dining','Groceries','Electricity','Water','Internet','Transport','Fuel','ETC','Hotels','Flights','Clothing','Shoes','Household goods','Education','Healthcare','Cosmetics','Entertainment','Toys','Shopping','Pets','Weddings','Birthdays','Lucky money','Gifts','Stock investments','Gold investments','Other'];
  type_icons text[] := array['utensils','shopping-basket','lightbulb','droplets','wifi','bus','fuel','ticket','hotel','plane','shirt','footprints','house','graduation-cap','heart-pulse','sparkles','gamepad-2','toy-brick','shopping-cart','paw-print','heart','cake-slice','gift','gift','chart-candlestick','coins','tag'];
  payment_names text[] := array['Chuyển khoản','Thẻ tín dụng','Trả góp','Urbox','Tiền mặt'];
  payment_names_en text[] := array['Bank transfer','Credit card','Installments','Urbox','Cash'];
  payment_icons text[] := array['landmark','credit-card','credit-card','ticket','banknote'];
  n text;
  i int;
begin
  if not public.is_family_owner(p_family_id) then raise exception 'FORBIDDEN'; end if;
  i := 1;
  foreach n in array names loop
    insert into public.purposes(family_id,name,name_en,code,icon,sort_order)
      values(p_family_id,n,names_en[i],'purpose-'||(i - 1),icons[i],i - 1)
      on conflict(family_id,code) do nothing;
    i := i + 1;
  end loop;
  i := 1;
  foreach n in array types loop
    insert into public.expense_types(family_id,name,name_en,code,icon,sort_order)
      values(p_family_id,n,types_en[i],'expense-'||(i - 1),type_icons[i],i - 1)
      on conflict(family_id,code) do nothing;
    i := i + 1;
  end loop;
  i := 1;
  foreach n in array payment_names loop
    insert into public.payment_methods(family_id,name,name_en,icon,sort_order)
      values(p_family_id,n,payment_names_en[i],payment_icons[i],i - 1)
      on conflict(family_id,name) do nothing;
    i := i + 1;
  end loop;
end $$;
grant execute on function public.seed_family_defaults(uuid) to authenticated;
