export class ConfigVerificationResponseDto {
    hasCurrentConfig: boolean;
    needsTrimestrialReview: boolean;
    changesDetected: boolean;
    lastConfig?: {
      id: number;
      costos_fijos_estimados: number;
      margen_contribucion_estimado?: number;
      dias_semana_activos: string;
      mes_aplicacion: string;
      tipo_actualizacion: string;
      ultima_actualizacion: Date;
    };
    message: string;
    blockDashboard: boolean;
  }