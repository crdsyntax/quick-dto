interface FieldDef {
  name: string;
  tsType: "string" | "number" | "boolean";
  example: string;
}

interface ModuleDef {
  plural: string;
  singular: string;
  cls: string;
  fields: FieldDef[];
  relations?: { targetPlural: string; targetCls: string; property: string }[];
}

const MODULES: ModuleDef[] = [
  {
    plural: "users",
    singular: "user",
    cls: "User",
    relations: [{ targetPlural: "roles", targetCls: "Role", property: "roles" }],
    fields: [
      { name: "name", tsType: "string", example: '"John Doe"' },
      { name: "email", tsType: "string", example: '"john@mail.com"' },
      { name: "password", tsType: "string", example: '"secret123"' },
      { name: "isActive", tsType: "boolean", example: "true" },
    ],
  },
  {
    plural: "roles",
    singular: "role",
    cls: "Role",
    relations: [{ targetPlural: "permissions", targetCls: "Permission", property: "permissions" }],
    fields: [
      { name: "name", tsType: "string", example: '"admin"' },
      { name: "description", tsType: "string", example: '"Administrator role"' },
    ],
  },
  {
    plural: "permissions",
    singular: "permission",
    cls: "Permission",
    fields: [
      { name: "name", tsType: "string", example: '"create_user"' },
      { name: "action", tsType: "string", example: '"create"' },
    ],
  },
];

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const validatorFor = (f: FieldDef): string => {
  if (f.tsType === "number") return "@IsNumber({}, { message: 'Please chose a valid number.' })";
  if (f.tsType === "boolean") return "@IsBoolean({ message: 'Please chose a valid boolean.' })";
  return "@IsString({ message: 'Please chose a valid string.' })";
};

function entityFile(m: ModuleDef): string {
  const relImports = (m.relations ?? [])
    .map((r) => `import { ${r.targetCls} } from "../${r.targetPlural}/entities/${r.targetPlural.slice(0, -1)}.entity";`)
    .join("\n");
  const relCols = (m.relations ?? [])
    .map(
      (r) =>
        `  @JoinTable()\n  @ManyToMany(() => ${r.targetCls}, (${r.property}) => ${r.property}.${m.plural})\n  ${r.property}: ${r.targetCls}[];`
    )
    .join("\n\n");
  const cols = m.fields
    .map(
      (f) =>
        `  @Column(${f.name === "email" ? "{ unique: true }" : ""})\n  ${f.name}: ${f.tsType};`
    )
    .join("\n\n");

  return `import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
${relImports}

@Entity("${m.plural}")
export class ${m.cls} {
  @PrimaryGeneratedColumn()
  id: number;

${cols}

${relCols ? relCols + "\n\n" : ""}  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
`;
}

function requestDto(m: ModuleDef): string {
  const createFields = m.fields
    .filter((f) => f.name !== "isActive")
    .map(
      (f) => `  @ApiProperty({ example: ${f.example} })
  ${validatorFor(f)}
  ${f.name}: ${f.tsType};`
    )
    .join("\n\n");

  const updateFields = m.fields
    .map(
      (f) => `  @ApiProperty({ example: ${f.example} })
  @IsOptional()
  ${validatorFor(f)}
  ${f.name}?: ${f.tsType};`
    )
    .join("\n\n");

  return `import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class Create${pascal(m.singular)}RequestDto {
${createFields}
}

export class Update${pascal(m.singular)}RequestDto {
${updateFields}
}
`;
}

function responseDto(m: ModuleDef): string {
  const relProps = (m.relations ?? [])
    .map(
      (r) => `  @ApiProperty({ type: ${r.targetCls}, isArray: true })
  ${r.property}?: Partial<${r.targetCls}>[];`
    )
    .join("\n\n");
  const fieldProps = m.fields
    .map((f) => `  @ApiProperty({ example: ${f.example} })\n  ${f.name}: ${f.tsType};`)
    .join("\n\n");

  return `import { ApiProperty } from "@nestjs/swagger";
${(m.relations ?? []).map((r) => `import { ${r.targetCls} } from "../../${r.targetPlural}/entities/${r.targetPlural.slice(0, -1)}.entity";`).join("\n")}

export class ${m.cls}ResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

${fieldProps}

${relProps}

  @ApiProperty({ example: "2026-01-01T00:00:00.000Z" })
  createdAt: Date;
}
`;
}

function repositoryFile(m: ModuleDef): string {
  const entity = `${m.singular}.entity`;
  const relations = (m.relations ?? []).map((r) => `"${r.property}"`).join(", ");
  const relOpt = relations ? `, { relations: [${relations}] }` : "";

  return `import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ${m.cls} } from "../entities/${entity}";

@Injectable()
export class ${pascal(m.plural)}Repository {
  constructor(private readonly dataSource: DataSource) {}

  private get repo() {
    return this.dataSource.getRepository(${m.cls});
  }

  findAll() {
    return this.repo.find({ order: { id: "ASC" }${relOpt} });
  }

  findById(id: number) {
    return this.repo.findOne({ where: { id }${relOpt} });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async create(data: Partial<${m.cls}>) {
    const created = this.repo.create(data as any);
    return this.repo.save(created);
  }

  async update(id: number, data: Partial<${m.cls}>) {
    await this.repo.update(id, data as any);
    return this.findById(id);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
`;
}

function serviceFile(m: ModuleDef): string {
  return `import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { ${pascal(m.plural)}Repository } from "../repository/${m.plural}.repository";
import { Create${pascal(m.singular)}RequestDto, Update${pascal(m.singular)}RequestDto } from "../dto/${m.singular}.request.dto";
import { mapToResponseDto } from "../helpers/${m.plural}.helpers";

@Injectable()
export class ${pascal(m.plural)}Service {
  constructor(private readonly repository: ${pascal(m.plural)}Repository) {}

  async findAll() {
    const items = await this.repository.findAll();
    return items.map(mapToResponseDto);
  }

  async findById(id: number) {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException("${m.cls} not found");
    return mapToResponseDto(item as any);
  }

  async create(dto: Create${pascal(m.singular)}RequestDto) {
    if (dto.email) {
      const exists = await this.repository.findByEmail(dto.email);
      if (exists) throw new ConflictException("Email already registered");
    }
    const created = await this.repository.create({ ...dto } as any);
    return mapToResponseDto(created as any);
  }

  async update(id: number, dto: Update${pascal(m.singular)}RequestDto) {
    await this.findById(id);
    const updated = await this.repository.update(id, { ...dto } as any);
    return mapToResponseDto(updated as any);
  }

  async remove(id: number) {
    await this.findById(id);
    await this.repository.remove(id);
    return { deleted: true };
  }
}
`;
}

function controllerFile(m: ModuleDef): string {
  const c = pascal(m.plural);
  return `import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ${c}Service } from "./services/${m.plural}.service";
import { Create${pascal(m.singular)}RequestDto, Update${pascal(m.singular)}RequestDto } from "./dto/${m.singular}.request.dto";
import { ${m.cls}ResponseDto } from "./dto/${m.singular}.response.dto";

@ApiTags("${m.plural}")
@Controller("${m.plural}")
export class ${c}Controller {
  constructor(private readonly service: ${c}Service) {}

  @Get()
  @ApiOperation({ summary: "Get all ${m.plural}" })
  @ApiOkResponse({ type: ${m.cls}ResponseDto, isArray: true })
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get ${m.singular} by id" })
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create ${m.singular}" })
  create(@Body() dto: Create${pascal(m.singular)}RequestDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: Update${pascal(m.singular)}RequestDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
`;
}

function helpersFile(m: ModuleDef): string {
  return `import { ${m.cls}ResponseDto } from "../dto/${m.singular}.response.dto";
import { ${m.cls} } from "../entities/${m.singular}.entity";

type EntityWithRelations = ${m.cls} & Record<string, unknown>;

export function mapToResponseDto(entity: EntityWithRelations): ${m.cls}ResponseDto {
  return {
    id: entity.id,
    ...Object.fromEntries(
      Object.entries(entity).filter(([key]) => !["id", "createdAt", "updatedAt"].includes(key))
    ),
    createdAt: entity.createdAt,
  } as unknown as ${m.cls}ResponseDto;
}
`;
}

function typesFile(m: ModuleDef): string {
  return `export enum ${m.cls}Status {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export interface ${m.cls}QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
}
`;
}

function moduleFile(m: ModuleDef): string {
  const c = pascal(m.plural);
  return `import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ${c}Controller } from "./${m.plural}.controller";
import { ${c}Service } from "./services/${m.plural}.service";
import { ${c}Repository } from "./repository/${m.plural}.repository";
import { ${m.cls} } from "./entities/${m.singular}.entity";

@Module({
  imports: [TypeOrmModule.forFeature([${m.cls}])],
  controllers: [${c}Controller],
  providers: [${c}Service, ${c}Repository],
  exports: [${c}Service],
})
export class ${c}Module {}
`;
}

const AUTH_FILES = () => ({
  "src/auth/auth.module.ts": `import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./services/auth.service";

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
`,
  "src/auth/auth.controller.ts": `import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./services/auth.service";
import { LoginRequestDto } from "./dto/login.request.dto";
import { LoginResponseDto } from "./dto/login.response.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Login with email and password" })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: LoginRequestDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
}
`,
  "src/auth/dto/login.request.dto.ts": `import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginRequestDto {
  @ApiProperty({ example: "admin@mail.com" })
  @IsEmail({}, { message: "Please chose a valid email." })
  email: string;

  @ApiProperty({ example: "secret123" })
  @IsString({ message: "Please chose a valid password." })
  @IsNotEmpty()
  password: string;
}
`,
  "src/auth/dto/login.response.dto.ts": `import { ApiProperty } from "@nestjs/swagger";

export class LoginResponseDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  accessToken: string;

  @ApiProperty({ example: "admin@mail.com" })
  email: string;

  @ApiProperty({ example: "Admin" })
  name: string;
}
`,
  "src/auth/services/auth.service.ts": `import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersRepository } from "../../users/repository/users.repository";
import { verifyPassword } from "../helpers/password.helpers";
import { LoginRequestDto } from "../dto/login.request.dto";
import { LoginResponseDto } from "../dto/login.response.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user || !verifyPassword(dto.password, user.password)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, email: user.email, name: user.name };
  }
}
`,
  "src/auth/helpers/password.helpers.ts": `import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, "hex"), candidate);
}
`,
  "src/auth/types/auth.types.ts": `export interface JwtPayload {
  sub: number;
  email: string;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
}
`,
});

export function generateNestModules(): Record<string, string> {
  const files: Record<string, string> = {};

  for (const m of MODULES) {
    files[`src/${m.plural}/${m.plural}.module.ts`] = moduleFile(m);
    files[`src/${m.plural}/${m.plural}.controller.ts`] = controllerFile(m);
    files[`src/${m.plural}/entities/${m.singular}.entity.ts`] = entityFile(m);
    files[`src/${m.plural}/dto/${m.singular}.request.dto.ts`] = requestDto(m);
    files[`src/${m.plural}/dto/${m.singular}.response.dto.ts`] = responseDto(m);
    files[`src/${m.plural}/repository/${m.plural}.repository.ts`] = repositoryFile(m);
    files[`src/${m.plural}/services/${m.plural}.service.ts`] = serviceFile(m);
    files[`src/${m.plural}/helpers/${m.plural}.helpers.ts`] = helpersFile(m);
    files[`src/${m.plural}/types/${m.plural}.types.ts`] = typesFile(m);
  }

  Object.assign(files, AUTH_FILES());
  return files;
}

export function patchAppModule(appModulePath: string, fs: typeof import("fs")): void {
  let content = fs.readFileSync(appModulePath, "utf8");
  const modulesToAdd = ["AuthModule", "UsersModule", "RolesModule", "PermissionsModule"];
  const importLines = modulesToAdd
    .map((mod, i) => `import { ${mod} } from "./${
      ["auth", "users", "roles", "permissions"][i]
    }/${["auth", "users", "roles", "permissions"][i]}.module";`)
    .join("\n");

  const lastImportIndex = content.lastIndexOf("import ");
  const lineEnd = content.indexOf("\n", lastImportIndex);
  content =
    content.slice(0, lineEnd + 1) +
    importLines +
    "\n" +
    content.slice(lineEnd + 1);

  if (/imports:\s*\[\s*\]/.test(content)) {
    content = content.replace("imports: []", "imports: [" + modulesToAdd.join(", ") + "]");
  } else {
    content = content.replace(/imports:\s*\[/, "imports: [" + modulesToAdd.join(", ") + ", ");
  }

  fs.writeFileSync(appModulePath, content, "utf8");
}

