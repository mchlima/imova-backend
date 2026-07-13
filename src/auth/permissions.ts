// Vocabulário canônico de permissões (RBAC).
//
// As permissões vivem no CÓDIGO, não no banco: só quem escreve as rotas sabe o que
// existe para proteger. O banco guarda apenas quais permissões cada role recebeu.
// Isso mantém o admin (que edita roles) incapaz de inventar permissões que nenhuma
// rota verifica — um erro clássico de RBAC editável.
//
// Convenção: '<recurso>:<ação>'. WILDCARD concede tudo (role de sistema).

export const WILDCARD = '*'

export interface PermissionDef {
  key: string
  label: string
  /** Explica o risco/alcance quando não é óbvio pelo label. */
  hint?: string
}

export interface PermissionGroup {
  key: string
  label: string
  permissions: PermissionDef[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'crm',
    label: 'CRM',
    permissions: [
      { key: 'opportunities:read', label: 'Ver oportunidades' },
      { key: 'opportunities:write', label: 'Criar e editar oportunidades' },
      { key: 'opportunities:delete', label: 'Excluir oportunidades' },
      { key: 'contacts:read', label: 'Ver contatos' },
      { key: 'contacts:write', label: 'Criar e editar contatos' },
      { key: 'documents:read', label: 'Ver e baixar documentos' },
      { key: 'documents:write', label: 'Enviar documentos' },
      { key: 'documents:delete', label: 'Excluir documentos' },
    ],
  },
  {
    key: 'crm_config',
    label: 'Configuração do CRM',
    permissions: [
      {
        key: 'pipelines:manage',
        label: 'Gerenciar pipelines e estágios',
        hint: 'Criar, renomear e excluir funis. Excluir um estágio afeta as oportunidades nele.',
      },
      {
        key: 'fields:manage',
        label: 'Gerenciar campos personalizados',
        hint: 'Alterar campos muda o formulário de todas as oportunidades.',
      },
    ],
  },
  {
    key: 'cms',
    label: 'CMS (guias e conteúdo)',
    permissions: [
      { key: 'cms:read', label: 'Ver posts, categorias e tags' },
      { key: 'cms:write', label: 'Criar e editar posts, categorias e tags' },
      { key: 'cms:publish', label: 'Publicar e despublicar posts', hint: 'Torna o conteúdo visível no site.' },
      { key: 'cms:delete', label: 'Excluir posts, categorias e tags' },
    ],
  },
  {
    key: 'catalog',
    label: 'Imóveis',
    permissions: [
      { key: 'developments:read', label: 'Ver empreendimentos' },
      { key: 'developments:write', label: 'Criar e editar empreendimentos' },
      { key: 'developments:publish', label: 'Publicar e despublicar empreendimentos', hint: 'Torna a página do imóvel visível no site.' },
      { key: 'developments:delete', label: 'Excluir empreendimentos' },
      { key: 'locations:manage', label: 'Editar taxas (ITBI e cartório)' },
    ],
  },
  {
    key: 'admin',
    label: 'Administração',
    permissions: [
      {
        key: 'users:manage',
        label: 'Gerenciar usuários e permissões',
        hint: 'Quem tem isso pode conceder qualquer permissão a si mesmo — equivale a acesso total.',
      },
    ],
  },
]

/** Todas as permissões concedíveis (sem o wildcard). */
export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
)

export function isValidPermission(key: string): boolean {
  return ALL_PERMISSIONS.includes(key)
}

/** Permissões concedidas a uma role, resolvendo o wildcard. */
export function expand(granted: string[]): string[] {
  return granted.includes(WILDCARD) ? ALL_PERMISSIONS : granted
}

export function hasPermission(granted: string[], required: string): boolean {
  return granted.includes(WILDCARD) || granted.includes(required)
}

// ── Roles padrão (semeadas na migração) ────────────────────────────────────
// ADMIN é isSystem: coringa, imutável e indelével.
// AGENT nasce com tudo do operacional; o que a distingue é não administrar usuários.
export const DEFAULT_ROLES = [
  {
    key: 'ADMIN',
    name: 'Administrador',
    description: 'Acesso total, incluindo gestão de usuários e permissões.',
    permissions: [WILDCARD],
    isSystem: true,
  },
  {
    key: 'AGENT',
    name: 'Corretor',
    description: 'Opera o CRM, o CMS e o catálogo de imóveis. Não gerencia usuários.',
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'users:manage'),
    isSystem: false,
  },
]
