export interface LoginResponse {
  tablaUsuario: string;
  idUsuario: string;
  username: string | null;
  password: string | null;
  idRevista: number;
  nmeRevista: string;
  token: string;
  staActivo: string;
  rol: string;
  formatoRevista: string;
  enabled: boolean;
  authorities: { authority: string }[];
  accountNonExpired: boolean;
  credentialsNonExpired: boolean;
  accountNonLocked: boolean;
}

export interface Session {
  token: string;
  idRevista: number;
  nmeRevista: string;
  expiresAt: Date;
}
