import type { LucideIcon } from 'lucide-react';
import {
  Baby,
  Banknote,
  Bike,
  Bus,
  CakeSlice,
  Car,
  ChartCandlestick,
  Coins,
  CreditCard,
  Droplets,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  HeartHandshake,
  HeartPulse,
  Hotel,
  House,
  Landmark,
  Lightbulb,
  PawPrint,
  Plane,
  ShoppingBasket,
  ShoppingCart,
  Shirt,
  Sparkles,
  Tag,
  Ticket,
  ToyBrick,
  Trash2,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
} from 'lucide-react';
import { normalizeText } from './domain';

type CatalogIconOption = {
  key: string;
  label: string;
  keywords: string[];
  Icon: LucideIcon;
};

export const catalogIconOptions = [
  { key: 'house', label: 'House', keywords: ['nhà cửa', 'gia đình', 'sinh hoạt', 'home'], Icon: House },
  { key: 'baby', label: 'Baby', keywords: ['con cái', 'thai sản', 'trẻ em', 'baby'], Icon: Baby },
  { key: 'plane', label: 'Plane', keywords: ['du lịch', 'vé máy bay', 'travel', 'flight'], Icon: Plane },
  { key: 'heart-handshake', label: 'Heart handshake', keywords: ['hiếu hỉ', 'quan hệ', 'cưới', 'relationships'], Icon: HeartHandshake },
  { key: 'car', label: 'Car', keywords: ['xe cộ', 'ô tô', 'car', 'vehicle'], Icon: Car },
  { key: 'bike', label: 'Bike', keywords: ['xe đạp', 'đạp xe', 'bicycle'], Icon: Bike },
  { key: 'heart-pulse', label: 'Heart pulse', keywords: ['sức khỏe', 'y tế', 'health', 'medical'], Icon: HeartPulse },
  { key: 'trending-up', label: 'Trending up', keywords: ['đầu tư', 'tăng trưởng', 'investments'], Icon: TrendingUp },
  { key: 'utensils', label: 'Utensils', keywords: ['ăn uống', 'đồ ăn', 'dining', 'food'], Icon: Utensils },
  { key: 'shopping-basket', label: 'Shopping basket', keywords: ['thực phẩm', 'đi chợ', 'groceries'], Icon: ShoppingBasket },
  { key: 'lightbulb', label: 'Lightbulb', keywords: ['điện', 'đèn', 'electricity'], Icon: Lightbulb },
  { key: 'droplets', label: 'Droplets', keywords: ['nước', 'water'], Icon: Droplets },
  { key: 'wifi', label: 'Wifi', keywords: ['internet', 'wifi', 'mạng'], Icon: Wifi },
  { key: 'bus', label: 'Bus', keywords: ['di chuyển', 'xe buýt', 'transport'], Icon: Bus },
  { key: 'fuel', label: 'Fuel', keywords: ['xăng', 'nhiên liệu', 'fuel'], Icon: Fuel },
  { key: 'ticket', label: 'Ticket', keywords: ['etc', 'vé', 'urbox', 'ticket'], Icon: Ticket },
  { key: 'trash-2', label: 'Trash 2', keywords: ['tiền rác', 'rác', 'waste', 'trash'], Icon: Trash2 },
  { key: 'hotel', label: 'Hotel', keywords: ['khách sạn', 'hotel'], Icon: Hotel },
  { key: 'shirt', label: 'Shirt', keywords: ['quần áo', 'clothing'], Icon: Shirt },
  { key: 'footprints', label: 'Footprints', keywords: ['giày dép', 'shoes', 'footwear'], Icon: Footprints },
  { key: 'graduation-cap', label: 'Graduation cap', keywords: ['giáo dục', 'học tập', 'education'], Icon: GraduationCap },
  { key: 'sparkles', label: 'Sparkles', keywords: ['mỹ phẩm', 'làm đẹp', 'cosmetics', 'beauty'], Icon: Sparkles },
  { key: 'gamepad-2', label: 'Gamepad 2', keywords: ['giải trí', 'game', 'entertainment'], Icon: Gamepad2 },
  { key: 'toy-brick', label: 'Toy brick', keywords: ['đồ chơi', 'toys'], Icon: ToyBrick },
  { key: 'shopping-cart', label: 'Shopping cart', keywords: ['tiêu dùng', 'mua sắm', 'shopping'], Icon: ShoppingCart },
  { key: 'paw-print', label: 'Paw print', keywords: ['thú cưng', 'pets'], Icon: PawPrint },
  { key: 'heart', label: 'Heart', keywords: ['đám cưới', 'tình yêu', 'wedding'], Icon: Heart },
  { key: 'cake-slice', label: 'Cake slice', keywords: ['sinh nhật', 'birthday', 'cake'], Icon: CakeSlice },
  { key: 'gift', label: 'Gift', keywords: ['lì xì', 'quà tặng', 'quà', 'gifts'], Icon: Gift },
  { key: 'chart-candlestick', label: 'Chart candlestick', keywords: ['chứng khoán', 'cổ phiếu', 'stocks'], Icon: ChartCandlestick },
  { key: 'coins', label: 'Coins', keywords: ['đầu tư vàng', 'vàng', 'gold', 'coins'], Icon: Coins },
  { key: 'landmark', label: 'Landmark', keywords: ['chuyển khoản', 'ngân hàng', 'bank transfer'], Icon: Landmark },
  { key: 'credit-card', label: 'Credit card', keywords: ['thẻ tín dụng', 'credit card'], Icon: CreditCard },
  { key: 'banknote', label: 'Banknote', keywords: ['tiền mặt', 'cash', 'money'], Icon: Banknote },
  { key: 'wallet', label: 'Wallet', keywords: ['ví', 'tài chính', 'wallet', 'finance'], Icon: Wallet },
  { key: 'tag', label: 'Tag', keywords: ['khác', 'chung', 'other', 'general'], Icon: Tag },
] as const satisfies readonly CatalogIconOption[];

export type CatalogIconKey = (typeof catalogIconOptions)[number]['key'];

const iconByKey = new Map<string, LucideIcon>(
  catalogIconOptions.map((option) => [option.key, option.Icon]),
);

const labelByKey = new Map<string, string>(
  catalogIconOptions.map((option) => [option.key, option.label]),
);

const defaultCatalogIcons: Record<string, CatalogIconKey> = {
  'Sinh hoạt gia đình': 'house',
  'Con cái': 'baby',
  'Du lịch': 'plane',
  'Hiếu hỉ & quan hệ': 'heart-handshake',
  'Nhà cửa & gia dụng': 'house',
  'Xe cộ': 'car',
  'Sức khỏe gia đình': 'heart-pulse',
  'Thai sản': 'baby',
  'Đầu tư': 'trending-up',
  'Ăn uống': 'utensils',
  'Thực phẩm': 'shopping-basket',
  'Điện': 'lightbulb',
  'Nước': 'droplets',
  Internet: 'wifi',
  'Di chuyển': 'bus',
  'Xăng': 'fuel',
  ETC: 'ticket',
  'Khách sạn': 'hotel',
  'Vé máy bay': 'plane',
  'Quần áo': 'shirt',
  'Giày dép': 'footprints',
  'Gia dụng': 'house',
  'Giáo dục': 'graduation-cap',
  'Sức khỏe': 'heart-pulse',
  'Sức khoẻ': 'heart-pulse',
  'Mỹ phẩm': 'sparkles',
  Spa: 'sparkles',
  'Giải trí': 'gamepad-2',
  'Đồ chơi': 'toy-brick',
  'Tiêu dùng': 'shopping-cart',
  'Thú cưng': 'paw-print',
  'Tiền rác': 'trash-2',
  'Đám cưới': 'heart',
  'Sinh nhật': 'cake-slice',
  'Lì xì': 'gift',
  'Sinh con': 'baby',
  Quà: 'gift',
  'Đầu tư chứng khoán': 'chart-candlestick',
  'Đầu tư vàng': 'coins',
  'Chuyển khoản': 'landmark',
  'Thẻ tín dụng': 'credit-card',
  'Trả góp': 'credit-card',
  Urbox: 'ticket',
  'Tiền mặt': 'banknote',
  'Quỹ ứng': 'wallet',
};

export function getDefaultCatalogIcon(name: string): CatalogIconKey {
  return defaultCatalogIcons[name] || 'tag';
}

export function normalizeCatalogIconKey(key: string | null | undefined): CatalogIconKey {
  return key && iconByKey.has(key) ? key as CatalogIconKey : 'tag';
}

export function getCatalogIcon(key: string | null | undefined): LucideIcon {
  return iconByKey.get(key || '') || Tag;
}

export function getCatalogIconLabel(key: string | null | undefined): string {
  return labelByKey.get(key || '') || labelByKey.get('tag') || 'Tag';
}

export function searchCatalogIcons(query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return catalogIconOptions;
  return catalogIconOptions.filter((option) =>
    [option.key, option.label, ...option.keywords].some((value) =>
      normalizeText(value).includes(normalizedQuery),
    ),
  );
}
