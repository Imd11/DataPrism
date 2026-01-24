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
    name: 'Panel Data Analysis',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    tags: ['research', 'economics'],
  },
  {
    id: 'proj-2',
    name: 'Sales Dashboard',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
    tags: ['business', 'quarterly'],
  },
];

// Mock Files
export const mockFiles: DataFile[] = [
  {
    id: 'file-1',
    name: 'companies.csv',
    type: 'csv',
    size: 245000,
    updatedAt: new Date('2024-01-15'),
    projectId: 'proj-1',
  },
  {
    id: 'file-2',
    name: 'financials.xlsx',
    type: 'xlsx',
    size: 512000,
    updatedAt: new Date('2024-01-16'),
    projectId: 'proj-1',
  },
  {
    id: 'file-3',
    name: 'years.csv',
    type: 'csv',
    size: 12000,
    updatedAt: new Date('2024-01-14'),
    projectId: 'proj-1',
  },
  {
    id: 'file-4',
    name: 'orders.csv',
    type: 'csv',
    size: 1024000,
    updatedAt: new Date('2024-01-17'),
    projectId: 'proj-2',
  },
  {
    id: 'file-5',
    name: 'customers.xlsx',
    type: 'xlsx',
    size: 256000,
    updatedAt: new Date('2024-01-18'),
    projectId: 'proj-2',
  },
];

// Mock Tables
export const mockTables: DataTable[] = [
  {
    id: 'table-companies',
    name: 'companies',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isIdentity: true },
      { name: 'company_id', type: 'text', nullable: false, isUnique: true },
      { name: 'company_name', type: 'varchar', nullable: false },
      { name: 'industry', type: 'text', nullable: true, missingCount: 5, missingRate: 0.02 },
      { name: 'founded_year', type: 'int4', nullable: true, missingCount: 12, missingRate: 0.05 },
      { name: 'employees', type: 'int4', nullable: true, missingCount: 8, missingRate: 0.03 },
      { name: 'country', type: 'text', nullable: false },
      { name: 'created_at', type: 'timestamptz', nullable: false },
      { name: 'updated_at', type: 'timestamptz', nullable: true },
    ],
    rowCount: 250,
    sourceType: 'imported',
    dirty: false,
    sourceFileId: 'file-1',
  },
  {
    id: 'table-financials',
    name: 'financials',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isIdentity: true },
      { name: 'company_id', type: 'text', nullable: false, isForeignKey: true, refTable: 'companies', refField: 'company_id' },
      { name: 'year', type: 'int4', nullable: false },
      { name: 'revenue', type: 'float8', nullable: true, missingCount: 15, missingRate: 0.03 },
      { name: 'profit', type: 'float8', nullable: true, missingCount: 22, missingRate: 0.04 },
      { name: 'assets', type: 'float8', nullable: true, missingCount: 8, missingRate: 0.02 },
      { name: 'liabilities', type: 'float8', nullable: true, missingCount: 8, missingRate: 0.02 },
      { name: 'created_at', type: 'timestamptz', nullable: false },
    ],
    rowCount: 500,
    sourceType: 'imported',
    dirty: true,
    sourceFileId: 'file-2',
  },
  {
    id: 'table-orders',
    name: 'orders',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isIdentity: true },
      { name: 'order_id', type: 'text', nullable: false, isUnique: true },
      { name: 'customer_id', type: 'text', nullable: false, isForeignKey: true, refTable: 'customers', refField: 'customer_id' },
      { name: 'order_date', type: 'timestamptz', nullable: false },
      { name: 'amount', type: 'float8', nullable: false },
      { name: 'status', type: 'text', nullable: false },
      { name: 'metadata', type: 'jsonb', nullable: true },
    ],
    rowCount: 1250,
    sourceType: 'imported',
    dirty: false,
    sourceFileId: 'file-4',
  },
  {
    id: 'table-customers',
    name: 'customers',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isIdentity: true },
      { name: 'customer_id', type: 'text', nullable: false, isUnique: true },
      { name: 'name', type: 'varchar', nullable: false },
      { name: 'email', type: 'text', nullable: true, missingCount: 45, missingRate: 0.09 },
      { name: 'region', type: 'text', nullable: false },
      { name: 'signup_date', type: 'timestamptz', nullable: false },
      { name: 'preferences', type: 'jsonb', nullable: true },
    ],
    rowCount: 500,
    sourceType: 'imported',
    dirty: false,
    sourceFileId: 'file-5',
  },
  {
    id: 'table-panel',
    name: 'panel_merged',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true },
      { name: 'company_id', type: 'text', nullable: false },
      { name: 'company_name', type: 'varchar', nullable: false },
      { name: 'year', type: 'int4', nullable: false },
      { name: 'industry', type: 'text', nullable: true },
      { name: 'revenue', type: 'float8', nullable: true },
      { name: 'profit', type: 'float8', nullable: true },
      { name: 'created_at', type: 'timestamptz', nullable: false },
    ],
    rowCount: 500,
    sourceType: 'derived',
    dirty: false,
    derivedFrom: ['table-companies', 'table-financials'],
    operation: 'merge',
  },
];

// Mock Relations (PK/FK)
export const mockRelations: RelationEdge[] = [
  {
    id: 'rel-1',
    fkTableId: 'table-financials',
    fkFields: ['company_id'],
    pkTableId: 'table-companies',
    pkFields: ['company_id'],
    cardinality: '1:m',
  },
  {
    id: 'rel-2',
    fkTableId: 'table-orders',
    fkFields: ['customer_id'],
    pkTableId: 'table-customers',
    pkFields: ['customer_id'],
    cardinality: '1:m',
  },
];

// Mock Lineages
export const mockLineages: LineageEdge[] = [
  {
    id: 'lin-1',
    derivedTableId: 'table-panel',
    sourceTableIds: ['table-companies', 'table-financials'],
    operation: 'merge',
  },
];

// Mock Table Data
const generateCompanyData = (): RowData[] => {
  const industries = ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', null];
  const countries = ['USA', 'China', 'Germany', 'Japan', 'UK', 'France'];
  
  return Array.from({ length: 50 }, (_, i) => ({
    company_id: `C${String(i + 1).padStart(4, '0')}`,
    company_name: `Company ${i + 1}`,
    industry: industries[Math.floor(Math.random() * industries.length)],
    founded_year: Math.random() > 0.05 ? 1980 + Math.floor(Math.random() * 44) : null,
    employees: Math.random() > 0.03 ? Math.floor(Math.random() * 50000) + 50 : null,
    country: countries[Math.floor(Math.random() * countries.length)],
  }));
};

const generateFinancialsData = (): RowData[] => {
  const years = [2020, 2021, 2022, 2023];
  const data: RowData[] = [];
  
  for (let i = 1; i <= 50; i++) {
    for (const year of years) {
      data.push({
        company_id: `C${String(i).padStart(4, '0')}`,
        year,
        revenue: Math.random() > 0.03 ? Math.floor(Math.random() * 1000000000) : null,
        profit: Math.random() > 0.04 ? Math.floor(Math.random() * 100000000) - 10000000 : null,
        assets: Math.random() > 0.02 ? Math.floor(Math.random() * 500000000) : null,
        liabilities: Math.random() > 0.02 ? Math.floor(Math.random() * 300000000) : null,
      });
    }
  }
  
  return data;
};

const generateOrdersData = (): RowData[] => {
  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  
  return Array.from({ length: 100 }, (_, i) => {
    const date = new Date(2024, 0, 1);
    date.setDate(date.getDate() + Math.floor(Math.random() * 30));
    
    return {
      order_id: `ORD${String(i + 1).padStart(6, '0')}`,
      customer_id: `CUST${String(Math.floor(Math.random() * 50) + 1).padStart(4, '0')}`,
      order_date: date.toISOString().split('T')[0],
      amount: Math.floor(Math.random() * 5000) + 50,
      status: statuses[Math.floor(Math.random() * statuses.length)],
    };
  });
};

const generateCustomersData = (): RowData[] => {
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'];
  
  return Array.from({ length: 50 }, (_, i) => {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const date = new Date(2023, 0, 1);
    date.setDate(date.getDate() + Math.floor(Math.random() * 365));
    
    return {
      customer_id: `CUST${String(i + 1).padStart(4, '0')}`,
      name: `${firstName} ${lastName}`,
      email: Math.random() > 0.09 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com` : null,
      region: regions[Math.floor(Math.random() * regions.length)],
      signup_date: date.toISOString().split('T')[0],
    };
  });
};

export const mockTableData: Record<string, RowData[]> = {
  'table-companies': generateCompanyData(),
  'table-financials': generateFinancialsData(),
  'table-orders': generateOrdersData(),
  'table-customers': generateCustomersData(),
  'table-panel': [], // Would be derived from merge
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
