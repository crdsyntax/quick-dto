export interface FieldDefinition {
    name: string;
    type: string;
    required: boolean;
    default?: any;
    validation?: string;
    description: string;
    example?: any;
    isRelation?: boolean;
    relationType?: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany';
    targetEntity?: string;
}

export interface EntityDefinition {
    name: string;
    description: string;
    tableName: string;
    fields: FieldDefinition[];
    relations: FieldDefinition[];
    indexes?: string[];
    uniqueConstraints?: string[];
}

export interface ModuleDefinition {
    name: string;
    description: string;
    entities: EntityDefinition[];
    dependencies: string[];
    apiEndpoints?: string[];
}

export class DataDictionary {
    private static readonly COMMON_FIELDS: FieldDefinition[] = [
        {
            name: 'id',
            type: 'string',
            required: true,
            description: 'Identificador único',
            example: 'uuid-v4'
        },

        {
            name: 'isActive',
            type: 'boolean',
            required: false,
            default: true,
            description: 'Estado activo/inactivo',
            example: true
        }
    ];

    private static readonly AUDIT_FIELDS: FieldDefinition[] = [
        {
            name: 'createdBy',
            type: 'string',
            required: true,
            description: 'Usuario creador',
            example: 'user-id'
        },
        {
            name: 'updatedBy',
            type: 'string',
            required: false,
            description: 'Usuario modificador',
            example: 'user-id'
        }
    ];

    public static getModuleDefinitions(): Map<string, ModuleDefinition> {
        const modules = new Map<string, ModuleDefinition>();

        modules.set('user', {
            name: 'user',
            description: 'Módulo de gestión de usuarios y autenticación',
            dependencies: ['auth'],
            apiEndpoints: ['/users', '/users/:id', '/users/profile'],
            entities: [this.getUserEntity(), this.getProfileEntity(), this.getRoleEntity()]
        });

        modules.set('auth', {
            name: 'auth',
            description: 'Módulo de autenticación y autorización',
            dependencies: ['user'],
            apiEndpoints: ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'],
            entities: [this.getAuthSessionEntity(), this.getPermissionEntity()]
        });

        modules.set('product', {
            name: 'product',
            description: 'Módulo de gestión de productos y catálogo',
            dependencies: ['category', 'inventory'],
            apiEndpoints: ['/products', '/products/:id', '/products/search', '/products/categories'],
            entities: [this.getProductEntity(), this.getProductVariantEntity(), this.getProductImageEntity()]
        });

        modules.set('category', {
            name: 'category',
            description: 'Módulo de categorización y organización',
            dependencies: [],
            apiEndpoints: ['/categories', '/categories/:id', '/categories/tree'],
            entities: [this.getCategoryEntity()]
        });

        modules.set('inventory', {
            name: 'inventory',
            description: 'Módulo de gestión de inventario y stock',
            dependencies: ['product', 'warehouse'],
            apiEndpoints: ['/inventory', '/inventory/:id', '/inventory/levels', '/inventory/movements'],
            entities: [this.getInventoryEntity(), this.getStockMovementEntity()]
        });

        modules.set('order', {
            name: 'order',
            description: 'Módulo de gestión de pedidos y ventas',
            dependencies: ['user', 'product', 'payment'],
            apiEndpoints: ['/orders', '/orders/:id', '/orders/user/:userId', '/orders/status'],
            entities: [this.getOrderEntity(), this.getOrderItemEntity(), this.getOrderStatusEntity()]
        });

        modules.set('payment', {
            name: 'payment',
            description: 'Módulo de procesamiento de pagos',
            dependencies: ['order'],
            apiEndpoints: ['/payments', '/payments/:id', '/payments/methods', '/payments/transactions'],
            entities: [this.getPaymentEntity(), this.getPaymentMethodEntity(), this.getTransactionEntity()]
        });

        modules.set('customer', {
            name: 'customer',
            description: 'Módulo de gestión de clientes',
            dependencies: ['user'],
            apiEndpoints: ['/customers', '/customers/:id', '/customers/contacts'],
            entities: [this.getCustomerEntity(), this.getCustomerAddressEntity(), this.getContactEntity()]
        });

        modules.set('warehouse', {
            name: 'warehouse',
            description: 'Módulo de gestión de almacenes y ubicaciones',
            dependencies: [],
            apiEndpoints: ['/warehouses', '/warehouses/:id', '/warehouses/locations'],
            entities: [this.getWarehouseEntity(), this.getLocationEntity()]
        });

        modules.set('settings', {
            name: 'settings',
            description: 'Módulo de configuración del sistema',
            dependencies: [],
            apiEndpoints: ['/settings', '/settings/:key'],
            entities: [this.getSettingEntity()]
        });

        modules.set('notifications', {
            name: 'notifications',
            description: 'Módulo de notificaciones (email, push, in-app)',
            dependencies: ['user'],
            apiEndpoints: ['/notifications', '/notifications/:id', '/notifications/user/:userId'],
            entities: [this.getNotificationEntity(), this.getNotificationTemplateEntity()]
        });

        modules.set('analytics', {
            name: 'analytics',
            description: 'Módulo para eventos analíticos y telemetría',
            dependencies: [],
            apiEndpoints: ['/analytics/events', '/analytics/summary'],
            entities: [this.getAnalyticsEventEntity(), this.getMetricEntity()]
        });

        modules.set('reporting', {
            name: 'reporting',
            description: 'Generación y almacenamiento de reportes',
            dependencies: ['analytics'],
            apiEndpoints: ['/reports', '/reports/:id', '/reports/generate'],
            entities: [this.getReportEntity(), this.getReportScheduleEntity()]
        });

        modules.set('audit', {
            name: 'audit',
            description: 'Registro de auditoría y trazabilidad de cambios',
            dependencies: ['user'],
            apiEndpoints: ['/audit', '/audit/:id'],
            entities: [this.getAuditLogEntity()]
        });

        modules.set('logs', {
            name: 'logs',
            description: 'Almacenamiento y consulta de logs del sistema',
            dependencies: [],
            apiEndpoints: ['/logs', '/logs/search'],
            entities: [this.getSystemLogEntity()]
        });

        modules.set('i18n', {
            name: 'i18n',
            description: 'Internacionalización: claves y traducciones',
            dependencies: [],
            apiEndpoints: ['/i18n/keys', '/i18n/keys/:id'],
            entities: [this.getI18nKeyEntity(), this.getI18nTranslationEntity()]
        });

        modules.set('search', {
            name: 'search',
            description: 'Indexado y búsqueda (fulltext / suggestions)',
            dependencies: ['product'],
            apiEndpoints: ['/search', '/search/suggest'],
            entities: [this.getSearchIndexEntity()]
        });

        modules.set('tagging', {
            name: 'tagging',
            description: 'Etiquetas y categorización general (tags)',
            dependencies: [],
            apiEndpoints: ['/tags', '/tags/:id'],
            entities: [this.getTagEntity(), this.getTaggingEntity()]
        });

        modules.set('comments', {
            name: 'comments',
            description: 'Comentarios y hilos (posts, items)',
            dependencies: ['user'],
            apiEndpoints: ['/comments', '/comments/:id', '/comments/thread/:threadId'],
            entities: [this.getCommentEntity(), this.getCommentThreadEntity()]
        });

        modules.set('feature-flags', {
            name: 'feature-flags',
            description: 'Gestión de feature flags y rollout',
            dependencies: [],
            apiEndpoints: ['/flags', '/flags/:key'],
            entities: [this.getFeatureFlagEntity()]
        });

        modules.set('billing', {
            name: 'billing',
            description: 'Facturación, pagos y suscripciones',
            dependencies: ['payment', 'user'],
            apiEndpoints: ['/billing/invoices', '/billing/payments'],
            entities: [this.getInvoiceEntity(), this.getBillingTransactionEntity()]
        });

        return modules;
    }

    private static getUserEntity(): EntityDefinition {
        return {
            name: 'User',
            description: 'Entidad de usuarios del sistema',
            tableName: 'users',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'email',
                    type: 'string',
                    required: true,
                    validation: 'email, unique',
                    description: 'Correo electrónico del usuario',
                    example: 'usuario@empresa.com'
                },
                {
                    name: 'password',
                    type: 'string',
                    required: true,
                    validation: 'min:8, hashed',
                    description: 'Contraseña hasheada',
                    example: '$2b$10$hashedpassword'
                },
                {
                    name: 'firstName',
                    type: 'string',
                    required: true,
                    validation: 'max:100',
                    description: 'Nombre del usuario',
                    example: 'Juan'
                },
                {
                    name: 'lastName',
                    type: 'string',
                    required: true,
                    validation: 'max:100',
                    description: 'Apellido del usuario',
                    example: 'Pérez'
                },
                {
                    name: 'phone',
                    type: 'string',
                    required: false,
                    validation: 'phone',
                    description: 'Teléfono del usuario',
                    example: '+1234567890'
                },
                {
                    name: 'avatar',
                    type: 'string',
                    required: false,
                    description: 'URL del avatar del usuario',
                    example: 'https://example.com/avatar.jpg'
                },
                {
                    name: 'lastLogin',
                    type: 'Date',
                    required: false,
                    description: 'Último inicio de sesión',
                    example: '2023-01-01T00:00:00.000Z'
                },
                {
                    name: 'isVerified',
                    type: 'boolean',
                    required: false,
                    default: false,
                    description: 'Indica si el email está verificado',
                    example: true
                }
            ],
            relations: [
                {
                    name: 'profile',
                    type: 'Profile',
                    required: false,
                    description: 'Perfil extendido del usuario',
                    isRelation: true,
                    relationType: 'OneToOne',
                    targetEntity: 'Profile'
                },
                {
                    name: 'roles',
                    type: 'Role[]',
                    required: false,
                    description: 'Roles del usuario',
                    isRelation: true,
                    relationType: 'ManyToMany',
                    targetEntity: 'Role'
                },
                {
                    name: 'orders',
                    type: 'Order[]',
                    required: false,
                    description: 'Pedidos del usuario',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'Order'
                }
            ],
            indexes: ['email', 'firstName', 'lastName'],
            uniqueConstraints: ['email']
        };
    }

    private static getProfileEntity(): EntityDefinition {
        return {
            name: 'Profile',
            description: 'Perfil extendido del usuario',
            tableName: 'profiles',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'bio',
                    type: 'text',
                    required: false,
                    description: 'Biografía del usuario',
                    example: 'Desarrollador full-stack con 5 años de experiencia'
                },
                {
                    name: 'website',
                    type: 'string',
                    required: false,
                    validation: 'url',
                    description: 'Sitio web personal',
                    example: 'https://miweb.com'
                },
                {
                    name: 'socialLinks',
                    type: 'json',
                    required: false,
                    description: 'Enlaces a redes sociales',
                    example: {
                        twitter: 'https://twitter.com/usuario',
                        github: 'https://github.com/usuario'
                    }
                },
                {
                    name: 'preferences',
                    type: 'json',
                    required: false,
                    description: 'Preferencias del usuario',
                    example: {
                        theme: 'dark',
                        language: 'es',
                        notifications: true
                    }
                }
            ],
            relations: [
                {
                    name: 'user',
                    type: 'User',
                    required: true,
                    description: 'Usuario asociado',
                    isRelation: true,
                    relationType: 'OneToOne',
                    targetEntity: 'User'
                }
            ],
            indexes: [],
            uniqueConstraints: []
        };
    }

    private static getRoleEntity(): EntityDefinition {
        return {
            name: 'Role',
            description: 'Roles de usuario del sistema',
            tableName: 'roles',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'name',
                    type: 'string',
                    required: true,
                    validation: 'unique, max:50',
                    description: 'Nombre del rol',
                    example: 'admin'
                },
                {
                    name: 'description',
                    type: 'string',
                    required: false,
                    description: 'Descripción del rol',
                    example: 'Administrador del sistema'
                },
                {
                    name: 'permissions',
                    type: 'string[]',
                    required: false,
                    description: 'Permisos del rol',
                    example: ['users.read', 'users.write', 'products.manage']
                }
            ],
            relations: [
                {
                    name: 'users',
                    type: 'User[]',
                    required: false,
                    description: 'Usuarios con este rol',
                    isRelation: true,
                    relationType: 'ManyToMany',
                    targetEntity: 'User'
                }
            ],
            indexes: ['name'],
            uniqueConstraints: ['name']
        };
    }

    private static getAuthSessionEntity(): EntityDefinition {
        return {
            name: 'AuthSession',
            description: 'Sesiones de autenticación de usuarios',
            tableName: 'auth_sessions',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'token',
                    type: 'string',
                    required: true,
                    description: 'Token de sesión',
                    example: 'jwt-token-string'
                },
                {
                    name: 'refreshToken',
                    type: 'string',
                    required: false,
                    description: 'Token de refresco',
                    example: 'refresh-token-string'
                },
                {
                    name: 'expiresAt',
                    type: 'Date',
                    required: true,
                    description: 'Fecha de expiración',
                    example: '2023-12-31T23:59:59.000Z'
                },
                {
                    name: 'ipAddress',
                    type: 'string',
                    required: false,
                    description: 'Dirección IP del cliente',
                    example: '192.168.1.1'
                },
                {
                    name: 'userAgent',
                    type: 'string',
                    required: false,
                    description: 'Agente de usuario',
                    example: 'Mozilla/5.0...'
                },
                {
                    name: 'isRevoked',
                    type: 'boolean',
                    required: false,
                    default: false,
                    description: 'Indica si la sesión fue revocada',
                    example: false
                }
            ],
            relations: [
                {
                    name: 'user',
                    type: 'User',
                    required: true,
                    description: 'Usuario de la sesión',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'User'
                }
            ],
            indexes: ['token', 'expiresAt', 'isRevoked'],
            uniqueConstraints: ['token']
        };
    }

    private static getPermissionEntity(): EntityDefinition {
        return {
            name: 'Permission',
            description: 'Permisos del sistema',
            tableName: 'permissions',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'name',
                    type: 'string',
                    required: true,
                    validation: 'unique, max:100',
                    description: 'Nombre del permiso',
                    example: 'users.create'
                },
                {
                    name: 'description',
                    type: 'string',
                    required: false,
                    description: 'Descripción del permiso',
                    example: 'Permite crear usuarios'
                },
                {
                    name: 'module',
                    type: 'string',
                    required: true,
                    description: 'Módulo del permiso',
                    example: 'users'
                },
                {
                    name: 'action',
                    type: 'string',
                    required: true,
                    description: 'Acción del permiso',
                    example: 'create'
                }
            ],
            relations: [
                {
                    name: 'roles',
                    type: 'Role[]',
                    required: false,
                    description: 'Roles que tienen este permiso',
                    isRelation: true,
                    relationType: 'ManyToMany',
                    targetEntity: 'Role'
                }
            ],
            indexes: ['name', 'module', 'action'],
            uniqueConstraints: ['name']
        };
    }

    private static getProductEntity(): EntityDefinition {
        return {
            name: 'Product',
            description: 'Entidad de productos del catálogo',
            tableName: 'products',
            fields: [
                ...this.COMMON_FIELDS,
                ...this.AUDIT_FIELDS,
                {
                    name: 'code',
                    type: 'string',
                    required: true,
                    validation: 'unique, max:50',
                    description: 'Código único del producto',
                    example: 'PROD-001'
                },
                {
                    name: 'name',
                    type: 'string',
                    required: true,
                    validation: 'max:255',
                    description: 'Nombre del producto',
                    example: 'Laptop Gaming Pro'
                },
                {
                    name: 'description',
                    type: 'text',
                    required: false,
                    description: 'Descripción detallada del producto',
                    example: 'Laptop para gaming con RTX 4080'
                },
                {
                    name: 'price',
                    type: 'number',
                    required: true,
                    validation: 'min:0',
                    description: 'Precio del producto',
                    example: 1299.99
                },
                {
                    name: 'cost',
                    type: 'number',
                    required: false,
                    validation: 'min:0',
                    description: 'Costo del producto',
                    example: 899.99
                },
                {
                    name: 'sku',
                    type: 'string',
                    required: true,
                    validation: 'unique, max:100',
                    description: 'SKU único del producto',
                    example: 'SKU-LAP-GAM-001'
                },
                {
                    name: 'weight',
                    type: 'number',
                    required: false,
                    description: 'Peso del producto en kg',
                    example: 2.5
                },
                {
                    name: 'dimensions',
                    type: 'json',
                    required: false,
                    description: 'Dimensiones del producto (alto, ancho, profundidad)',
                    example: { height: 20, width: 30, depth: 15 }
                },
                {
                    name: 'tags',
                    type: 'string[]',
                    required: false,
                    description: 'Etiquetas del producto',
                    example: ['gaming', 'laptop', 'premium']
                },
                {
                    name: 'metadata',
                    type: 'json',
                    required: false,
                    description: 'Metadatos adicionales del producto',
                    example: { brand: 'ASUS', model: 'ROG Strix' }
                }
            ],
            relations: [
                {
                    name: 'category',
                    type: 'Category',
                    required: true,
                    description: 'Categoría del producto',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Category'
                },
                {
                    name: 'variants',
                    type: 'ProductVariant[]',
                    required: false,
                    description: 'Variantes del producto',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'ProductVariant'
                },
                {
                    name: 'images',
                    type: 'ProductImage[]',
                    required: false,
                    description: 'Imágenes del producto',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'ProductImage'
                },
                {
                    name: 'inventory',
                    type: 'Inventory',
                    required: false,
                    description: 'Información de inventario',
                    isRelation: true,
                    relationType: 'OneToOne',
                    targetEntity: 'Inventory'
                }
            ],
            indexes: ['code', 'name', 'sku', 'price'],
            uniqueConstraints: ['code', 'sku']
        };
    }

    private static getProductVariantEntity(): EntityDefinition {
        return {
            name: 'ProductVariant',
            description: 'Variantes de productos (tamaños, colores, etc.)',
            tableName: 'product_variants',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'sku',
                    type: 'string',
                    required: true,
                    validation: 'unique, max:100',
                    description: 'SKU único de la variante',
                    example: 'SKU-LAP-GAM-001-BLACK'
                },
                {
                    name: 'name',
                    type: 'string',
                    required: true,
                    description: 'Nombre de la variante',
                    example: 'Color Negro'
                },
                {
                    name: 'price',
                    type: 'number',
                    required: false,
                    description: 'Precio específico de la variante',
                    example: 1349.99
                },
                {
                    name: 'attributes',
                    type: 'json',
                    required: false,
                    description: 'Atributos de la variante',
                    example: { color: 'black', storage: '1TB', ram: '32GB' }
                },
                {
                    name: 'stock',
                    type: 'number',
                    required: false,
                    default: 0,
                    description: 'Stock disponible',
                    example: 50
                }
            ],
            relations: [
                {
                    name: 'product',
                    type: 'Product',
                    required: true,
                    description: 'Producto padre',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Product'
                }
            ],
            indexes: ['sku'],
            uniqueConstraints: ['sku']
        };
    }

    private static getProductImageEntity(): EntityDefinition {
        return {
            name: 'ProductImage',
            description: 'Imágenes de productos',
            tableName: 'product_images',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'url',
                    type: 'string',
                    required: true,
                    description: 'URL de la imagen',
                    example: 'https://example.com/image1.jpg'
                },
                {
                    name: 'altText',
                    type: 'string',
                    required: false,
                    description: 'Texto alternativo',
                    example: 'Laptop Gaming Pro - Vista frontal'
                },
                {
                    name: 'order',
                    type: 'number',
                    required: false,
                    default: 0,
                    description: 'Orden de visualización',
                    example: 1
                },
                {
                    name: 'isPrimary',
                    type: 'boolean',
                    required: false,
                    default: false,
                    description: 'Indica si es la imagen principal',
                    example: true
                }
            ],
            relations: [
                {
                    name: 'product',
                    type: 'Product',
                    required: true,
                    description: 'Producto de la imagen',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Product'
                }
            ],
            indexes: ['order', 'isPrimary'],
            uniqueConstraints: []
        };
    }

    private static getCategoryEntity(): EntityDefinition {
        return {
            name: 'Category',
            description: 'Entidad de categorías de productos',
            tableName: 'categories',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'name',
                    type: 'string',
                    required: true,
                    validation: 'max:100',
                    description: 'Nombre de la categoría',
                    example: 'Electrónicos'
                },
                {
                    name: 'description',
                    type: 'text',
                    required: false,
                    description: 'Descripción de la categoría',
                    example: 'Productos electrónicos y tecnología'
                },
                {
                    name: 'slug',
                    type: 'string',
                    required: true,
                    validation: 'unique, max:120',
                    description: 'Slug para URLs',
                    example: 'electronicos'
                },
                {
                    name: 'image',
                    type: 'string',
                    required: false,
                    description: 'Imagen de la categoría',
                    example: 'https://example.com/category.jpg'
                },
                {
                    name: 'order',
                    type: 'number',
                    required: false,
                    default: 0,
                    description: 'Orden de visualización',
                    example: 1
                }
            ],
            relations: [
                {
                    name: 'parent',
                    type: 'Category',
                    required: false,
                    description: 'Categoría padre',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Category'
                },
                {
                    name: 'children',
                    type: 'Category[]',
                    required: false,
                    description: 'Subcategorías',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'Category'
                },
                {
                    name: 'products',
                    type: 'Product[]',
                    required: false,
                    description: 'Productos en esta categoría',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'Product'
                }
            ],
            indexes: ['name', 'slug', 'order'],
            uniqueConstraints: ['slug']
        };
    }

    private static getInventoryEntity(): EntityDefinition {
        return {
            name: 'Inventory',
            description: 'Registro de inventario de productos',
            tableName: 'inventory',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'quantity',
                    type: 'number',
                    required: true,
                    default: 0,
                    description: 'Cantidad disponible',
                    example: 100
                },
                {
                    name: 'reserved',
                    type: 'number',
                    required: false,
                    default: 0,
                    description: 'Cantidad reservada',
                    example: 10
                },
                {
                    name: 'minStock',
                    type: 'number',
                    required: false,
                    default: 0,
                    description: 'Stock mínimo alerta',
                    example: 5
                },
                {
                    name: 'maxStock',
                    type: 'number',
                    required: false,
                    description: 'Stock máximo',
                    example: 1000
                },
                {
                    name: 'location',
                    type: 'string',
                    required: false,
                    description: 'Ubicación en almacén',
                    example: 'A1-B2-C3'
                }
            ],
            relations: [
                {
                    name: 'product',
                    type: 'Product',
                    required: true,
                    description: 'Producto del inventario',
                    isRelation: true,
                    relationType: 'OneToOne',
                    targetEntity: 'Product'
                },
                {
                    name: 'warehouse',
                    type: 'Warehouse',
                    required: false,
                    description: 'Almacén donde se encuentra',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Warehouse'
                }
            ],
            indexes: ['quantity', 'location'],
            uniqueConstraints: []
        };
    }

    private static getStockMovementEntity(): EntityDefinition {
        return {
            name: 'StockMovement',
            description: 'Movimientos de stock en inventario',
            tableName: 'stock_movements',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'type',
                    type: 'string',
                    required: true,
                    description: 'Tipo de movimiento',
                    example: 'IN'
                },
                {
                    name: 'quantity',
                    type: 'number',
                    required: true,
                    description: 'Cantidad movida',
                    example: 50
                },
                {
                    name: 'reason',
                    type: 'string',
                    required: false,
                    description: 'Razón del movimiento',
                    example: 'Compra a proveedor'
                },
                {
                    name: 'reference',
                    type: 'string',
                    required: false,
                    description: 'Referencia externa',
                    example: 'PO-2023-001'
                },
                {
                    name: 'notes',
                    type: 'text',
                    required: false,
                    description: 'Notas adicionales',
                    example: 'Lote #12345'
                }
            ],
            relations: [
                {
                    name: 'inventory',
                    type: 'Inventory',
                    required: true,
                    description: 'Inventario afectado',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Inventory'
                },
                {
                    name: 'product',
                    type: 'Product',
                    required: true,
                    description: 'Producto del movimiento',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Product'
                }
            ],
            indexes: ['type', 'createdAt'],
            uniqueConstraints: []
        };
    }

    private static getOrderEntity(): EntityDefinition {
        return {
            name: 'Order',
            description: 'Entidad de pedidos y órdenes de venta',
            tableName: 'orders',
            fields: [
                ...this.COMMON_FIELDS,
                ...this.AUDIT_FIELDS,
                {
                    name: 'orderNumber',
                    type: 'string',
                    required: true,
                    validation: 'unique',
                    description: 'Número único de orden',
                    example: 'ORD-2023-001'
                },
                {
                    name: 'totalAmount',
                    type: 'number',
                    required: true,
                    validation: 'min:0',
                    description: 'Monto total de la orden',
                    example: 1599.98
                },
                {
                    name: 'subtotal',
                    type: 'number',
                    required: true,
                    description: 'Subtotal antes de impuestos',
                    example: 1454.53
                },
                {
                    name: 'taxAmount',
                    type: 'number',
                    required: true,
                    description: 'Monto de impuestos',
                    example: 145.45
                },
                {
                    name: 'shippingAmount',
                    type: 'number',
                    required: true,
                    description: 'Costo de envío',
                    example: 15.00
                },
                {
                    name: 'currency',
                    type: 'string',
                    required: true,
                    default: 'USD',
                    description: 'Moneda de la transacción',
                    example: 'USD'
                },
                {
                    name: 'status',
                    type: 'string',
                    required: true,
                    default: 'pending',
                    description: 'Estado de la orden',
                    example: 'completed'
                },
                {
                    name: 'notes',
                    type: 'text',
                    required: false,
                    description: 'Notas adicionales de la orden',
                    example: 'Entregar antes de las 5pm'
                },
                {
                    name: 'shippingAddress',
                    type: 'json',
                    required: true,
                    description: 'Dirección de envío',
                    example: {
                        street: '123 Main St',
                        city: 'New York',
                        state: 'NY',
                        zipCode: '10001',
                        country: 'US'
                    }
                },
                {
                    name: 'billingAddress',
                    type: 'json',
                    required: false,
                    description: 'Dirección de facturación',
                    example: {
                        street: '123 Main St',
                        city: 'New York',
                        state: 'NY',
                        zipCode: '10001',
                        country: 'US'
                    }
                }
            ],
            relations: [
                {
                    name: 'user',
                    type: 'User',
                    required: true,
                    description: 'Usuario que realizó el pedido',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'User'
                },
                {
                    name: 'items',
                    type: 'OrderItem[]',
                    required: true,
                    description: 'Items del pedido',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'OrderItem'
                },
                {
                    name: 'payments',
                    type: 'Payment[]',
                    required: false,
                    description: 'Pagos asociados al pedido',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'Payment'
                },
                {
                    name: 'statusHistory',
                    type: 'OrderStatus[]',
                    required: false,
                    description: 'Historial de estados del pedido',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'OrderStatus'
                }
            ],
            indexes: ['orderNumber', 'status', 'createdAt'],
            uniqueConstraints: ['orderNumber']
        };
    }

    private static getOrderItemEntity(): EntityDefinition {
        return {
            name: 'OrderItem',
            description: 'Items individuales de un pedido',
            tableName: 'order_items',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'quantity',
                    type: 'number',
                    required: true,
                    description: 'Cantidad del producto',
                    example: 2
                },
                {
                    name: 'unitPrice',
                    type: 'number',
                    required: true,
                    description: 'Precio unitario',
                    example: 799.99
                },
                {
                    name: 'totalPrice',
                    type: 'number',
                    required: true,
                    description: 'Precio total (quantity * unitPrice)',
                    example: 1599.98
                },
                {
                    name: 'productName',
                    type: 'string',
                    required: true,
                    description: 'Nombre del producto al momento del pedido',
                    example: 'Laptop Gaming Pro'
                },
                {
                    name: 'productSku',
                    type: 'string',
                    required: true,
                    description: 'SKU del producto al momento del pedido',
                    example: 'SKU-LAP-GAM-001'
                }
            ],
            relations: [
                {
                    name: 'order',
                    type: 'Order',
                    required: true,
                    description: 'Pedido al que pertenece',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Order'
                },
                {
                    name: 'product',
                    type: 'Product',
                    required: true,
                    description: 'Producto del item',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Product'
                }
            ],
            indexes: ['productSku'],
            uniqueConstraints: []
        };
    }

    private static getOrderStatusEntity(): EntityDefinition {
        return {
            name: 'OrderStatus',
            description: 'Historial de estados de un pedido',
            tableName: 'order_status_history',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'status',
                    type: 'string',
                    required: true,
                    description: 'Estado del pedido',
                    example: 'shipped'
                },
                {
                    name: 'notes',
                    type: 'text',
                    required: false,
                    description: 'Notas del cambio de estado',
                    example: 'Paquete enviado con tracking #12345'
                }
            ],
            relations: [
                {
                    name: 'order',
                    type: 'Order',
                    required: true,
                    description: 'Pedido del historial',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Order'
                }
            ],
            indexes: ['status', 'createdAt'],
            uniqueConstraints: []
        };
    }

    // Entidades restantes con implementaciones básicas
    private static getPaymentEntity(): EntityDefinition {
        return {
            name: 'Payment',
            description: 'Pagos de pedidos',
            tableName: 'payments',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'amount',
                    type: 'number',
                    required: true,
                    description: 'Monto del pago',
                    example: 1599.98
                },
                {
                    name: 'currency',
                    type: 'string',
                    required: true,
                    default: 'USD',
                    description: 'Moneda del pago',
                    example: 'USD'
                },
                {
                    name: 'status',
                    type: 'string',
                    required: true,
                    description: 'Estado del pago',
                    example: 'completed'
                },
                {
                    name: 'gateway',
                    type: 'string',
                    required: true,
                    description: 'Pasarela de pago',
                    example: 'stripe'
                },
                {
                    name: 'transactionId',
                    type: 'string',
                    required: false,
                    description: 'ID de transacción externa',
                    example: 'txn_123456789'
                }
            ],
            relations: [
                {
                    name: 'order',
                    type: 'Order',
                    required: true,
                    description: 'Pedido del pago',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Order'
                }
            ],
            indexes: ['status', 'gateway', 'createdAt'],
            uniqueConstraints: ['transactionId']
        };
    }

    private static getPaymentMethodEntity(): EntityDefinition {
        return {
            name: 'PaymentMethod',
            description: 'Métodos de pago de usuarios',
            tableName: 'payment_methods',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'type',
                    type: 'string',
                    required: true,
                    description: 'Tipo de método de pago',
                    example: 'credit_card'
                },
                {
                    name: 'provider',
                    type: 'string',
                    required: true,
                    description: 'Proveedor del método',
                    example: 'visa'
                },
                {
                    name: 'lastFour',
                    type: 'string',
                    required: false,
                    description: 'Últimos 4 dígitos',
                    example: '4242'
                },
                {
                    name: 'isDefault',
                    type: 'boolean',
                    required: false,
                    default: false,
                    description: 'Método por defecto',
                    example: true
                }
            ],
            relations: [
                {
                    name: 'user',
                    type: 'User',
                    required: true,
                    description: 'Usuario del método de pago',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'User'
                }
            ],
            indexes: ['type', 'provider', 'isDefault'],
            uniqueConstraints: []
        };
    }

    private static getTransactionEntity(): EntityDefinition {
        return {
            name: 'Transaction',
            description: 'Transacciones de pagos',
            tableName: 'transactions',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'amount',
                    type: 'number',
                    required: true,
                    description: 'Monto de la transacción',
                    example: 1599.98
                },
                {
                    name: 'type',
                    type: 'string',
                    required: true,
                    description: 'Tipo de transacción',
                    example: 'charge'
                },
                {
                    name: 'status',
                    type: 'string',
                    required: true,
                    description: 'Estado de la transacción',
                    example: 'succeeded'
                },
                {
                    name: 'gatewayResponse',
                    type: 'json',
                    required: false,
                    description: 'Respuesta de la pasarela',
                    example: { id: 'ch_123456', status: 'succeeded' }
                }
            ],
            relations: [
                {
                    name: 'payment',
                    type: 'Payment',
                    required: true,
                    description: 'Pago de la transacción',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Payment'
                }
            ],
            indexes: ['type', 'status', 'createdAt'],
            uniqueConstraints: []
        };
    }

    private static getCustomerEntity(): EntityDefinition {
        return {
            name: 'Customer',
            description: 'Clientes del sistema',
            tableName: 'customers',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'companyName',
                    type: 'string',
                    required: false,
                    description: 'Nombre de la empresa',
                    example: 'Tech Solutions Inc.'
                },
                {
                    name: 'taxId',
                    type: 'string',
                    required: false,
                    description: 'Identificación fiscal',
                    example: '123456789'
                },
                {
                    name: 'type',
                    type: 'string',
                    required: true,
                    default: 'individual',
                    description: 'Tipo de cliente',
                    example: 'business'
                }
            ],
            relations: [
                {
                    name: 'user',
                    type: 'User',
                    required: true,
                    description: 'Usuario asociado',
                    isRelation: true,
                    relationType: 'OneToOne',
                    targetEntity: 'User'
                },
                {
                    name: 'addresses',
                    type: 'CustomerAddress[]',
                    required: false,
                    description: 'Direcciones del cliente',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'CustomerAddress'
                }
            ],
            indexes: ['companyName', 'type'],
            uniqueConstraints: ['taxId']
        };
    }

    private static getCustomerAddressEntity(): EntityDefinition {
        return {
            name: 'CustomerAddress',
            description: 'Direcciones de clientes',
            tableName: 'customer_addresses',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'type',
                    type: 'string',
                    required: true,
                    description: 'Tipo de dirección',
                    example: 'shipping'
                },
                {
                    name: 'street',
                    type: 'string',
                    required: true,
                    description: 'Calle',
                    example: '123 Main St'
                },
                {
                    name: 'city',
                    type: 'string',
                    required: true,
                    description: 'Ciudad',
                    example: 'New York'
                },
                {
                    name: 'state',
                    type: 'string',
                    required: true,
                    description: 'Estado/Provincia',
                    example: 'NY'
                },
                {
                    name: 'zipCode',
                    type: 'string',
                    required: true,
                    description: 'Código postal',
                    example: '10001'
                },
                {
                    name: 'country',
                    type: 'string',
                    required: true,
                    description: 'País',
                    example: 'US'
                },
                {
                    name: 'isDefault',
                    type: 'boolean',
                    required: false,
                    default: false,
                    description: 'Dirección por defecto',
                    example: true
                }
            ],
            relations: [
                {
                    name: 'customer',
                    type: 'Customer',
                    required: true,
                    description: 'Cliente de la dirección',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Customer'
                }
            ],
            indexes: ['type', 'isDefault'],
            uniqueConstraints: []
        };
    }

    private static getContactEntity(): EntityDefinition {
        return {
            name: 'Contact',
            description: 'Contactos de clientes',
            tableName: 'contacts',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'firstName',
                    type: 'string',
                    required: true,
                    description: 'Nombre del contacto',
                    example: 'María'
                },
                {
                    name: 'lastName',
                    type: 'string',
                    required: true,
                    description: 'Apellido del contacto',
                    example: 'González'
                },
                {
                    name: 'email',
                    type: 'string',
                    required: false,
                    description: 'Email del contacto',
                    example: 'maria@empresa.com'
                },
                {
                    name: 'phone',
                    type: 'string',
                    required: false,
                    description: 'Teléfono del contacto',
                    example: '+1234567890'
                },
                {
                    name: 'position',
                    type: 'string',
                    required: false,
                    description: 'Cargo del contacto',
                    example: 'Gerente de Ventas'
                }
            ],
            relations: [
                {
                    name: 'customer',
                    type: 'Customer',
                    required: true,
                    description: 'Cliente del contacto',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Customer'
                }
            ],
            indexes: ['firstName', 'lastName', 'email'],
            uniqueConstraints: []
        };
    }

    private static getWarehouseEntity(): EntityDefinition {
        return {
            name: 'Warehouse',
            description: 'Almacenes del sistema',
            tableName: 'warehouses',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'name',
                    type: 'string',
                    required: true,
                    description: 'Nombre del almacén',
                    example: 'Almacén Central'
                },
                {
                    name: 'code',
                    type: 'string',
                    required: true,
                    validation: 'unique',
                    description: 'Código del almacén',
                    example: 'WH-001'
                },
                {
                    name: 'address',
                    type: 'json',
                    required: true,
                    description: 'Dirección del almacén',
                    example: {
                        street: '456 Warehouse St',
                        city: 'Chicago',
                        state: 'IL',
                        zipCode: '60601',
                        country: 'US'
                    }
                },
                {
                    name: 'contact',
                    type: 'json',
                    required: false,
                    description: 'Información de contacto',
                    example: {
                        phone: '+1234567890',
                        email: 'warehouse@empresa.com'
                    }
                }
            ],
            relations: [
                {
                    name: 'locations',
                    type: 'Location[]',
                    required: false,
                    description: 'Ubicaciones en el almacén',
                    isRelation: true,
                    relationType: 'OneToMany',
                    targetEntity: 'Location'
                }
            ],
            indexes: ['name', 'code'],
            uniqueConstraints: ['code']
        };
    }

    private static getLocationEntity(): EntityDefinition {
        return {
            name: 'Location',
            description: 'Ubicaciones dentro de almacenes',
            tableName: 'locations',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'code',
                    type: 'string',
                    required: true,
                    description: 'Código de ubicación',
                    example: 'A1-B2-C3'
                },
                {
                    name: 'name',
                    type: 'string',
                    required: false,
                    description: 'Nombre de la ubicación',
                    example: 'Pasillo A, Estante 1'
                },
                {
                    name: 'capacity',
                    type: 'number',
                    required: false,
                    description: 'Capacidad máxima',
                    example: 1000
                }
            ],
            relations: [
                {
                    name: 'warehouse',
                    type: 'Warehouse',
                    required: true,
                    description: 'Almacén de la ubicación',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'Warehouse'
                }
            ],
            indexes: ['code'],
            uniqueConstraints: ['code']
        };
    }

    private static getSettingEntity(): EntityDefinition {
        return {
            name: 'Setting',
            description: 'Configuraciones del sistema',
            tableName: 'settings',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'key',
                    type: 'string',
                    required: true,
                    validation: 'unique',
                    description: 'Clave de la configuración',
                    example: 'app.theme'
                },
                {
                    name: 'value',
                    type: 'json',
                    required: true,
                    description: 'Valor de la configuración',
                    example: 'dark'
                },
                {
                    name: 'type',
                    type: 'string',
                    required: true,
                    description: 'Tipo de valor',
                    example: 'string'
                },
                {
                    name: 'description',
                    type: 'string',
                    required: false,
                    description: 'Descripción de la configuración',
                    example: 'Tema de la aplicación'
                },
                {
                    name: 'isPublic',
                    type: 'boolean',
                    required: false,
                    default: false,
                    description: 'Configuración pública',
                    example: true
                }
            ],
            relations: [],
            indexes: ['key', 'type'],
            uniqueConstraints: ['key']
        };
    }

    // Entidades adicionales (patrones comunes)
    private static getNotificationEntity(): EntityDefinition {
        return {
            name: 'Notification',
            description: 'Notificaciones dirigidas a usuarios (in-app, push, email)',
            tableName: 'notifications',
            fields: [
                ...this.COMMON_FIELDS,
                {
                    name: 'title',
                    type: 'string',
                    required: true,
                    description: 'Título de la notificación',
                    example: 'Nuevo mensaje'
                },
                {
                    name: 'body',
                    type: 'text',
                    required: false,
                    description: 'Contenido de la notificación',
                    example: 'Tienes un nuevo mensaje en tu bandeja'
                },
                {
                    name: 'channel',
                    type: 'string',
                    required: true,
                    description: 'Canal (email, push, in-app)',
                    example: 'in-app'
                },
                {
                    name: 'read',
                    type: 'boolean',
                    required: false,
                    default: false,
                    description: 'Marca si la notificación fue leída',
                    example: false
                }
            ],
            relations: [
                {
                    name: 'user',
                    type: 'User',
                    required: true,
                    description: 'Usuario destinatario',
                    isRelation: true,
                    relationType: 'ManyToOne',
                    targetEntity: 'User'
                }
            ],
            indexes: ['user', 'createdAt'],
            uniqueConstraints: []
        };
    }

    private static getNotificationTemplateEntity(): EntityDefinition {
        return {
            name: 'NotificationTemplate',
            description: 'Plantillas reutilizables para notificaciones',
            tableName: 'notification_templates',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'key', type: 'string', required: true, description: 'Clave de la plantilla', example: 'welcome_email' },
                { name: 'subject', type: 'string', required: false, description: 'Asunto (email)', example: 'Bienvenido' },
                { name: 'body', type: 'text', required: true, description: 'Cuerpo con placeholders', example: 'Hola {{name}}' }
            ],
            relations: [],
            indexes: ['key'],
            uniqueConstraints: ['key']
        };
    }

    private static getAnalyticsEventEntity(): EntityDefinition {
        return {
            name: 'AnalyticsEvent',
            description: 'Eventos de telemetría y analítica',
            tableName: 'analytics_events',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'event', type: 'string', required: true, description: 'Nombre del evento', example: 'page_view' },
                { name: 'payload', type: 'json', required: false, description: 'Datos asociados al evento', example: {} },
                { name: 'source', type: 'string', required: false, description: 'Origen (web, mobile)', example: 'web' }
            ],
            relations: [],
            indexes: ['event', 'createdAt'],
            uniqueConstraints: []
        };
    }

    private static getMetricEntity(): EntityDefinition {
        return {
            name: 'Metric',
            description: 'Métricas agregadas y series temporales',
            tableName: 'metrics',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'name', type: 'string', required: true, description: 'Nombre métrica', example: 'daily_active_users' },
                { name: 'value', type: 'number', required: true, description: 'Valor numérico', example: 123 },
                { name: 'timestamp', type: 'Date', required: true, description: 'Fecha de la métrica', example: '2023-01-01T00:00:00.000Z' }
            ],
            relations: [],
            indexes: ['name', 'timestamp'],
            uniqueConstraints: []
        };
    }

    private static getReportEntity(): EntityDefinition {
        return {
            name: 'Report',
            description: 'Reportes generados (PDF, CSV, etc.)',
            tableName: 'reports',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'type', type: 'string', required: true, description: 'Tipo de reporte', example: 'sales' },
                { name: 'status', type: 'string', required: true, description: 'Estado (pending, ready)', example: 'pending' },
                { name: 'fileUrl', type: 'string', required: false, description: 'URL al archivo generado', example: 'https://...' }
            ],
            relations: [],
            indexes: ['status', 'createdAt'],
            uniqueConstraints: []
        };
    }

    private static getReportScheduleEntity(): EntityDefinition {
        return {
            name: 'ReportSchedule',
            description: 'Programación de generación de reportes',
            tableName: 'report_schedules',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'cron', type: 'string', required: true, description: 'Expresión cron', example: '0 0 * * *' },
                { name: 'params', type: 'json', required: false, description: 'Parámetros para la generación', example: {} }
            ],
            relations: [],
            indexes: ['cron'],
            uniqueConstraints: []
        };
    }

    private static getAuditLogEntity(): EntityDefinition {
        return {
            name: 'AuditLog',
            description: 'Registro de acciones y cambios para auditoría',
            tableName: 'audit_logs',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'entity', type: 'string', required: true, description: 'Entidad afectada', example: 'User' },
                { name: 'entityId', type: 'string', required: true, description: 'ID de la entidad afectada', example: 'uuid' },
                { name: 'action', type: 'string', required: true, description: 'Acción realizada', example: 'update' },
                { name: 'changes', type: 'json', required: false, description: 'Cambios aplicados', example: {} }
            ],
            relations: [
                { name: 'performedBy', type: 'User', required: false, description: 'Usuario que realizó la acción', isRelation: true, relationType: 'ManyToOne', targetEntity: 'User' }
            ],
            indexes: ['entity', 'entityId', 'createdAt'],
            uniqueConstraints: []
        };
    }

    private static getSystemLogEntity(): EntityDefinition {
        return {
            name: 'SystemLog',
            description: 'Logs técnicos del sistema (errors, warnings, info)',
            tableName: 'system_logs',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'level', type: 'string', required: true, description: 'Nivel (error, warn, info)', example: 'error' },
                { name: 'message', type: 'text', required: true, description: 'Mensaje de log', example: 'DB connection failed' },
                { name: 'meta', type: 'json', required: false, description: 'Metadatos adicionales', example: {} }
            ],
            relations: [],
            indexes: ['level', 'createdAt'],
            uniqueConstraints: []
        };
    }

    private static getI18nKeyEntity(): EntityDefinition {
        return {
            name: 'I18nKey',
            description: 'Claves de texto para internacionalización',
            tableName: 'i18n_keys',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'key', type: 'string', required: true, description: 'Clave identificadora', example: 'welcome.title' }
            ],
            relations: [],
            indexes: ['key'],
            uniqueConstraints: ['key']
        };
    }

    private static getI18nTranslationEntity(): EntityDefinition {
        return {
            name: 'I18nTranslation',
            description: 'Traducciones asociadas a claves i18n',
            tableName: 'i18n_translations',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'key', type: 'string', required: true, description: 'Clave i18n', example: 'welcome.title' },
                { name: 'locale', type: 'string', required: true, description: 'Locale (es, en)', example: 'es' },
                { name: 'value', type: 'text', required: true, description: 'Texto traducido', example: 'Bienvenido' }
            ],
            relations: [],
            indexes: ['key', 'locale'],
            uniqueConstraints: [['key', 'locale'] as any]
        };
    }

    private static getSearchIndexEntity(): EntityDefinition {
        return {
            name: 'SearchIndex',
            description: 'Índices para búsqueda y sugerencias',
            tableName: 'search_indexes',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'entity', type: 'string', required: true, description: 'Entidad indexada', example: 'Product' },
                { name: 'entityId', type: 'string', required: true, description: 'ID de la entidad', example: 'uuid' },
                { name: 'payload', type: 'json', required: false, description: 'Datos indexados', example: {} }
            ],
            relations: [],
            indexes: ['entity', 'entityId'],
            uniqueConstraints: []
        };
    }

    private static getTagEntity(): EntityDefinition {
        return {
            name: 'Tag',
            description: 'Etiqueta reutilizable para clasificar recursos',
            tableName: 'tags',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'name', type: 'string', required: true, description: 'Nombre de la etiqueta', example: 'featured' },
                { name: 'slug', type: 'string', required: true, description: 'Slug', example: 'featured' }
            ],
            relations: [],
            indexes: ['slug'],
            uniqueConstraints: ['slug']
        };
    }

    private static getTaggingEntity(): EntityDefinition {
        return {
            name: 'Tagging',
            description: 'Relación genérica entre tags y recursos',
            tableName: 'taggings',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'tagId', type: 'string', required: true, description: 'ID de la etiqueta', example: 'uuid' },
                { name: 'targetType', type: 'string', required: true, description: 'Tipo de recurso etiquetado', example: 'Product' },
                { name: 'targetId', type: 'string', required: true, description: 'ID del recurso etiquetado', example: 'uuid' }
            ],
            relations: [],
            indexes: ['tagId', 'targetType', 'targetId'],
            uniqueConstraints: []
        };
    }

    private static getCommentEntity(): EntityDefinition {
        return {
            name: 'Comment',
            description: 'Comentarios individuales',
            tableName: 'comments',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'content', type: 'text', required: true, description: 'Contenido del comentario', example: 'Buen artículo' },
                { name: 'authorName', type: 'string', required: false, description: 'Nombre del autor', example: 'Ana' }
            ],
            relations: [
                { name: 'thread', type: 'CommentThread', required: false, description: 'Hilo asociado', isRelation: true, relationType: 'ManyToOne', targetEntity: 'CommentThread' },
                { name: 'user', type: 'User', required: false, description: 'Usuario autor', isRelation: true, relationType: 'ManyToOne', targetEntity: 'User' }
            ],
            indexes: ['thread', 'createdAt'],
            uniqueConstraints: []
        };
    }

    private static getCommentThreadEntity(): EntityDefinition {
        return {
            name: 'CommentThread',
            description: 'Hilos de comentarios (por recurso)',
            tableName: 'comment_threads',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'targetType', type: 'string', required: true, description: 'Tipo de recurso', example: 'Product' },
                { name: 'targetId', type: 'string', required: true, description: 'ID del recurso', example: 'uuid' }
            ],
            relations: [],
            indexes: ['targetType', 'targetId'],
            uniqueConstraints: []
        };
    }

    private static getFeatureFlagEntity(): EntityDefinition {
        return {
            name: 'FeatureFlag',
            description: 'Flags/feature toggles para control de funcionalidades',
            tableName: 'feature_flags',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'key', type: 'string', required: true, description: 'Clave del flag', example: 'new_checkout' },
                { name: 'enabled', type: 'boolean', required: true, default: false, description: 'Estado', example: false },
                { name: 'conditions', type: 'json', required: false, description: 'Reglas de activación', example: {} }
            ],
            relations: [],
            indexes: ['key'],
            uniqueConstraints: ['key']
        };
    }

    private static getInvoiceEntity(): EntityDefinition {
        return {
            name: 'Invoice',
            description: 'Facturas y documentos de cobro',
            tableName: 'invoices',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'invoiceNumber', type: 'string', required: true, description: 'Número de factura', example: 'INV-2023-001' },
                { name: 'amount', type: 'number', required: true, description: 'Monto facturado', example: 199.99 },
                { name: 'status', type: 'string', required: true, description: 'Estado (paid, pending)', example: 'pending' }
            ],
            relations: [
                { name: 'user', type: 'User', required: true, description: 'Cliente relacionado', isRelation: true, relationType: 'ManyToOne', targetEntity: 'User' }
            ],
            indexes: ['invoiceNumber', 'status'],
            uniqueConstraints: ['invoiceNumber']
        };
    }

    private static getBillingTransactionEntity(): EntityDefinition {
        return {
            name: 'BillingTransaction',
            description: 'Registro de transacciones de facturación/pago',
            tableName: 'billing_transactions',
            fields: [
                ...this.COMMON_FIELDS,
                { name: 'invoiceId', type: 'string', required: true, description: 'Factura asociada', example: 'uuid' },
                { name: 'amount', type: 'number', required: true, description: 'Monto', example: 199.99 },
                { name: 'provider', type: 'string', required: false, description: 'Proveedor de pago', example: 'stripe' },
                { name: 'status', type: 'string', required: true, description: 'Estado', example: 'succeeded' }
            ],
            relations: [],
            indexes: ['invoiceId', 'status'],
            uniqueConstraints: []
        };
    }

    // Métodos para obtener entidades por nombre
    public static getEntityDefinition(entityName: string): EntityDefinition | undefined {
        const modules = this.getModuleDefinitions();
        for (const module of modules.values()) {
            const entity = module.entities.find(e => e.name === entityName);
            if (entity) return entity;
        }
        return undefined;
    }

    public static getModuleForEntity(entityName: string): string | undefined {
        const modules = this.getModuleDefinitions();
        for (const [moduleName, module] of modules.entries()) {
            if (module.entities.some(e => e.name === entityName)) {
                return moduleName;
            }
        }
        return undefined;
    }

    public static getAvailableModules(): string[] {
        return Array.from(this.getModuleDefinitions().keys());
    }

    public static getModuleEntities(moduleName: string): EntityDefinition[] {
        const module = this.getModuleDefinitions().get(moduleName);
        return module ? module.entities : [];
    }
}