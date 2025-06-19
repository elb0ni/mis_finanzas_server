export interface BusinessDailySummary {
  transactions: Transaction[];
  summary: Summary;
}

export interface Summary {
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
}

export interface TransactionWithDetails extends Omit<Transaction, 'detalles'> {
  detalles: Detalle[];
}

export interface Transaction {
  id: number;
  punto_venta_id: number;
  tipo: string;
  fecha: Date;
  monto_total: string;
  categoria_id: number | null;
  fecha_creacion: Date;
  concepto: string | null;
  punto_venta_nombre?: string;
  categoria_nombre?: string | null;
  detalles?: Detalle[];
}

export interface Detalle {
  id: number;
  transaccion_id: number;
  producto_id: number;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  producto_nombre: string;
  unidad_medida: string;
}
