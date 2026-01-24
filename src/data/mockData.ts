import type { 
  Project, 
  DataFile, 
  DataTable, 
  RelationEdge, 
  LineageEdge,
  RowData,
  SummaryResult,
  QualityReport
} from '@/types/data';

// Mock Projects
export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'E-Commerce Analytics',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    tags: ['sales', 'analytics'],
  },
];

// Mock Files
export const mockFiles: DataFile[] = [
  { id: 'file-1', name: 'customers.csv', type: 'csv', size: 125000, updatedAt: new Date('2024-01-15'), projectId: 'proj-1' },
  { id: 'file-2', name: 'products.csv', type: 'csv', size: 85000, updatedAt: new Date('2024-01-16'), projectId: 'proj-1' },
  { id: 'file-3', name: 'orders.csv', type: 'csv', size: 512000, updatedAt: new Date('2024-01-17'), projectId: 'proj-1' },
  { id: 'file-4', name: 'order_items.csv', type: 'csv', size: 1024000, updatedAt: new Date('2024-01-17'), projectId: 'proj-1' },
  { id: 'file-5', name: 'categories.csv', type: 'csv', size: 12000, updatedAt: new Date('2024-01-14'), projectId: 'proj-1' },
];

// ============================================
// REALISTIC E-COMMERCE DATA TABLES
// ============================================

// 1. CUSTOMERS - 客户表 (customer_id 是主键)
export const mockTables: DataTable[] = [
  {
    id: 'table-customers',
    name: 'customers',
    fields: [
      { name: 'customer_id', type: 'int4', nullable: false, isPrimaryKey: true, isUnique: true },
      { name: 'first_name', type: 'varchar', nullable: false },
      { name: 'last_name', type: 'varchar', nullable: false },
      { name: 'email', type: 'text', nullable: true, missingCount: 12, missingRate: 0.04 },
      { name: 'phone', type: 'varchar', nullable: true, missingCount: 35, missingRate: 0.12 },
      { name: 'city', type: 'varchar', nullable: false },
      { name: 'country', type: 'varchar', nullable: false },
      { name: 'created_at', type: 'timestamptz', nullable: false },
    ],
    rowCount: 300,
    sourceType: 'imported',
    dirty: false,
    sourceFileId: 'file-1',
  },
  
  // 2. CATEGORIES - 商品类别表 (category_id 是主键)
  {
    id: 'table-categories',
    name: 'categories',
    fields: [
      { name: 'category_id', type: 'int4', nullable: false, isPrimaryKey: true, isUnique: true },
      { name: 'category_name', type: 'varchar', nullable: false },
      { name: 'description', type: 'text', nullable: true },
    ],
    rowCount: 8,
    sourceType: 'imported',
    dirty: false,
    sourceFileId: 'file-5',
  },
  
  // 3. PRODUCTS - 产品表 (product_id 是主键, category_id 关联类别)
  {
    id: 'table-products',
    name: 'products',
    fields: [
      { name: 'product_id', type: 'int4', nullable: false, isPrimaryKey: true, isUnique: true },
      { name: 'product_name', type: 'varchar', nullable: false },
      { name: 'category_id', type: 'int4', nullable: false, isForeignKey: true, refTable: 'categories', refField: 'category_id' },
      { name: 'price', type: 'float8', nullable: false },
      { name: 'stock_quantity', type: 'int4', nullable: false },
      { name: 'supplier', type: 'varchar', nullable: true, missingCount: 8, missingRate: 0.08 },
    ],
    rowCount: 100,
    sourceType: 'imported',
    dirty: false,
    sourceFileId: 'file-2',
  },
  
  // 4. ORDERS - 订单表 (order_id 是主键, customer_id 关联客户)
  {
    id: 'table-orders',
    name: 'orders',
    fields: [
      { name: 'order_id', type: 'int4', nullable: false, isPrimaryKey: true, isUnique: true },
      { name: 'customer_id', type: 'int4', nullable: false, isForeignKey: true, refTable: 'customers', refField: 'customer_id' },
      { name: 'order_date', type: 'date', nullable: false },
      { name: 'ship_date', type: 'date', nullable: true, missingCount: 45, missingRate: 0.06 },
      { name: 'status', type: 'varchar', nullable: false },
      { name: 'total_amount', type: 'float8', nullable: false },
    ],
    rowCount: 750,
    sourceType: 'imported',
    dirty: true,
    sourceFileId: 'file-3',
  },
  
  // 5. ORDER_ITEMS - 订单明细表 (order_id + product_id 关联)
  {
    id: 'table-order-items',
    name: 'order_items',
    fields: [
      { name: 'item_id', type: 'int4', nullable: false, isPrimaryKey: true, isUnique: true },
      { name: 'order_id', type: 'int4', nullable: false, isForeignKey: true, refTable: 'orders', refField: 'order_id' },
      { name: 'product_id', type: 'int4', nullable: false, isForeignKey: true, refTable: 'products', refField: 'product_id' },
      { name: 'quantity', type: 'int4', nullable: false },
      { name: 'unit_price', type: 'float8', nullable: false },
      { name: 'discount', type: 'float8', nullable: true },
    ],
    rowCount: 2150,
    sourceType: 'imported',
    dirty: false,
    sourceFileId: 'file-4',
  },
];

// Mock Relations (PK/FK) - 这些是硬编码的，但 Canvas 会自动检测
export const mockRelations: RelationEdge[] = [];

// Mock Lineages - 用于派生表
export const mockLineages: LineageEdge[] = [];

// ============================================
// REALISTIC DATA GENERATORS
// ============================================

const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Oliver', 'Sophia', 'Elijah', 'Isabella', 'James', 'Mia', 'Benjamin', 'Charlotte', 'Lucas', 'Amelia', 'Mason', 'Harper', 'Ethan', 'Evelyn', 'Alexander'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte'];
const countries = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Australia', 'Japan'];

const generateCustomersData = (): RowData[] => {
  return Array.from({ length: 300 }, (_, i) => {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const date = new Date(2022, Math.floor(Math.random() * 24), Math.floor(Math.random() * 28) + 1);
    
    return {
      customer_id: i + 1,
      first_name: firstName,
      last_name: lastName,
      email: Math.random() > 0.04 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com` : null,
      phone: Math.random() > 0.12 ? `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}` : null,
      city: cities[Math.floor(Math.random() * cities.length)],
      country: countries[Math.floor(Math.random() * countries.length)],
      created_at: date.toISOString(),
    };
  });
};

const categories = [
  { category_id: 1, category_name: 'Electronics', description: 'Electronic devices and accessories' },
  { category_id: 2, category_name: 'Clothing', description: 'Apparel and fashion items' },
  { category_id: 3, category_name: 'Home & Garden', description: 'Home improvement and garden supplies' },
  { category_id: 4, category_name: 'Sports', description: 'Sports equipment and outdoor gear' },
  { category_id: 5, category_name: 'Books', description: 'Books, magazines, and publications' },
  { category_id: 6, category_name: 'Toys', description: 'Toys and games for all ages' },
  { category_id: 7, category_name: 'Beauty', description: 'Beauty and personal care products' },
  { category_id: 8, category_name: 'Food', description: 'Food and beverages' },
];

const generateCategoriesData = (): RowData[] => categories;

const productNames: Record<number, string[]> = {
  1: ['Wireless Headphones', 'Smart Watch', 'Bluetooth Speaker', 'USB-C Hub', 'Mechanical Keyboard', 'Gaming Mouse', 'Webcam HD', '4K Monitor', 'Tablet Stand', 'Power Bank', 'Wireless Charger', 'Smart Bulb'],
  2: ['Cotton T-Shirt', 'Denim Jeans', 'Wool Sweater', 'Running Shoes', 'Leather Belt', 'Silk Scarf', 'Winter Jacket', 'Casual Shorts', 'Dress Shirt', 'Sports Socks', 'Baseball Cap', 'Sunglasses'],
  3: ['Garden Hose', 'LED Desk Lamp', 'Tool Set', 'Plant Pot', 'Wall Clock', 'Throw Pillow', 'Area Rug', 'Storage Box', 'Picture Frame', 'Candle Set', 'Door Mat', 'Curtains'],
  4: ['Yoga Mat', 'Dumbbells Set', 'Tennis Racket', 'Soccer Ball', 'Bike Helmet', 'Swimming Goggles', 'Camping Tent', 'Hiking Backpack', 'Jump Rope', 'Resistance Bands', 'Water Bottle', 'Fitness Tracker'],
  5: ['Fiction Novel', 'Cookbook', 'Self-Help Book', 'History Book', 'Science Journal', 'Art Magazine', 'Travel Guide', 'Biography', 'Poetry Collection', 'Graphic Novel', 'Dictionary', 'Textbook'],
  6: ['Building Blocks', 'Board Game', 'Puzzle Set', 'Action Figure', 'Stuffed Animal', 'RC Car', 'Card Game', 'Science Kit', 'Doll House', 'Play Dough', 'Toy Train', 'Musical Toy'],
  7: ['Face Cream', 'Lipstick', 'Shampoo', 'Perfume', 'Nail Polish', 'Hair Dryer', 'Makeup Brush', 'Sunscreen', 'Body Lotion', 'Face Mask', 'Eye Shadow', 'Mascara'],
  8: ['Organic Coffee', 'Green Tea', 'Chocolate Bar', 'Olive Oil', 'Honey Jar', 'Pasta Pack', 'Spice Set', 'Snack Mix', 'Energy Bar', 'Fruit Jam', 'Rice Pack', 'Cereal Box'],
};

const suppliers = ['GlobalTech', 'PrimeSupply', 'DirectSource', 'QualityFirst', 'ValueMart', null, 'TopGoods', 'BestDeal'];

const generateProductsData = (): RowData[] => {
  const products: RowData[] = [];
  let productId = 1;
  
  for (let catId = 1; catId <= 8; catId++) {
    const names = productNames[catId];
    for (const name of names) {
      products.push({
        product_id: productId++,
        product_name: name,
        category_id: catId,
        price: Math.round((Math.random() * 200 + 10) * 100) / 100,
        stock_quantity: Math.floor(Math.random() * 500) + 10,
        supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
      });
    }
  }
  
  return products;
};

const orderStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const generateOrdersData = (): RowData[] => {
  return Array.from({ length: 750 }, (_, i) => {
    const orderDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
    let shipDate: string | null = null;
    
    if (status === 'Shipped' || status === 'Delivered') {
      const ship = new Date(orderDate);
      ship.setDate(ship.getDate() + Math.floor(Math.random() * 5) + 1);
      shipDate = ship.toISOString().split('T')[0];
    }
    
    return {
      order_id: 1000 + i,
      customer_id: Math.floor(Math.random() * 300) + 1,
      order_date: orderDate.toISOString().split('T')[0],
      ship_date: shipDate,
      status,
      total_amount: Math.round((Math.random() * 500 + 20) * 100) / 100,
    };
  });
};

const generateOrderItemsData = (): RowData[] => {
  const items: RowData[] = [];
  let itemId = 1;
  
  // Each order has 1-5 items
  for (let orderId = 1000; orderId < 1750; orderId++) {
    const itemCount = Math.floor(Math.random() * 4) + 1;
    const usedProducts = new Set<number>();
    
    for (let j = 0; j < itemCount; j++) {
      let productId: number;
      do {
        productId = Math.floor(Math.random() * 96) + 1;
      } while (usedProducts.has(productId));
      usedProducts.add(productId);
      
      const unitPrice = Math.round((Math.random() * 100 + 10) * 100) / 100;
      
      items.push({
        item_id: itemId++,
        order_id: orderId,
        product_id: productId,
        quantity: Math.floor(Math.random() * 5) + 1,
        unit_price: unitPrice,
        discount: Math.random() > 0.7 ? Math.round(Math.random() * 20) / 100 : null,
      });
    }
  }
  
  return items;
};

export const mockTableData: Record<string, RowData[]> = {
  'table-customers': generateCustomersData(),
  'table-categories': generateCategoriesData(),
  'table-products': generateProductsData(),
  'table-orders': generateOrdersData(),
  'table-order-items': generateOrderItemsData(),
};

// Generate summary for a table
export const generateMockSummary = (table: DataTable): SummaryResult => {
  const data = mockTableData[table.id] || [];
  
  const numericStats = table.fields
    .filter(f => f.type === 'number')
    .map(field => {
      const values = data
        .map(row => row[field.name])
        .filter((v): v is number => typeof v === 'number');
      
      const sorted = [...values].sort((a, b) => a - b);
      const n = sorted.length;
      
      return {
        field: field.name,
        count: n,
        mean: n > 0 ? values.reduce((a, b) => a + b, 0) / n : 0,
        std: n > 0 ? Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - (values.reduce((a, b) => a + b, 0) / n), 2), 0) / n) : 0,
        min: sorted[0] || 0,
        p25: sorted[Math.floor(n * 0.25)] || 0,
        median: sorted[Math.floor(n * 0.5)] || 0,
        p75: sorted[Math.floor(n * 0.75)] || 0,
        max: sorted[n - 1] || 0,
        missing: data.length - n,
      };
    });

  const categoricalStats = table.fields
    .filter(f => f.type === 'string')
    .map(field => {
      const values = data
        .map(row => row[field.name])
        .filter((v): v is string => typeof v === 'string');
      
      const counts: Record<string, number> = {};
      values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      
      const topValues = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));
      
      return {
        field: field.name,
        uniqueCount: Object.keys(counts).length,
        topValues,
        missing: data.length - values.length,
      };
    });

  return {
    tableId: table.id,
    tableName: table.name,
    numericStats,
    categoricalStats,
    timestamp: new Date(),
  };
};

// Generate quality report for a table
export const generateMockQuality = (table: DataTable): QualityReport => {
  const data = mockTableData[table.id] || [];
  
  const missingByColumn = table.fields.map(field => {
    const missing = data.filter(row => row[field.name] === null || row[field.name] === undefined).length;
    return {
      field: field.name,
      count: missing,
      rate: data.length > 0 ? missing / data.length : 0,
    };
  }).filter(m => m.count > 0);

  return {
    tableId: table.id,
    tableName: table.name,
    totalRows: data.length,
    totalColumns: table.fields.length,
    missingByColumn,
    duplicatesByKey: [],
    typeIssues: [],
    keyConflicts: [],
    timestamp: new Date(),
  };
};
