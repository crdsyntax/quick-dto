import * as vscode from 'vscode';
import * as fs from 'fs';
import { HttpTesterGenerator, HttpCollection } from '../generators/http-tester.generator';
import { HttpTesterPanel } from '../views/http-tester.view'; // Asegúrate que la ruta sea correcta

/**
 * Comando para generar colecciones HTTP a partir de un archivo controlador de NestJS.
 * @param context Contexto de la extensión.
 * @param fileUri URI del archivo controlador seleccionado.
 */
export async function generateCollectionsFromControllerCommand(context: vscode.ExtensionContext, fileUri: vscode.Uri) {
    if (!fileUri || !fileUri.fsPath) {
        vscode.window.showErrorMessage('No se pudo obtener la ruta del archivo.');
        return;
    }

    try {
        const controllerCode = fs.readFileSync(fileUri.fsPath, 'utf8');

        // 1. Pedir la URL Base al usuario
        const baseUrl = await vscode.window.showInputBox({
            prompt: 'Introduce la URL Base del API (ej: http://localhost:3000)',
            value: vscode.workspace.getConfiguration('nest-tools').get('defaultBaseUrl', 'http://localhost:3000'),
            ignoreFocusOut: true
        });

        if (!baseUrl) {
            vscode.window.showWarningMessage('Operación cancelada. Se requiere una URL base.');
            return;
        }

        const dtoContents = {
             // Simulación de DTOs con el contenido proporcionado por el usuario:
             "CreateNotificationDto": `
                import { ApiPropertyOptional } from "@nestjs/swagger";
                import { IsOptional, IsString, IsBoolean, IsNumber } from "class-validator";
                export class CreateNotificationDto {
                  @IsOptional() @IsString() @ApiPropertyOptional({ type: String }) userid?: string;
                  @IsOptional() @IsString() @ApiPropertyOptional({ type: String }) contextoid?: string;
                  @IsOptional() @IsString() @ApiPropertyOptional({ type: String }) body?: string;
                  @IsOptional() @IsBoolean() @ApiPropertyOptional({ type: Boolean }) read?: boolean;
                  @IsOptional() @IsBoolean() @ApiPropertyOptional({ type: Boolean }) admin?: boolean;
                  @IsOptional() @IsString() @ApiPropertyOptional({ type: String }) title?: string;
                  @IsOptional() @IsString() @ApiPropertyOptional({ type: String }) date?: string;
                  @IsOptional() @IsString() @ApiPropertyOptional({ type: String }) link?: string;
                  @IsOptional() @IsBoolean() @ApiPropertyOptional({ type: Boolean }) active?: boolean;
                  @IsOptional() @IsString() @ApiPropertyOptional({ type: String }) createdBy?: string;
                }`,
             // DTO de ejemplo para el PATCH
             "UpdateNotificationDto": `
                import { IsOptional, IsBoolean, IsNumber } from "class-validator";
                export class UpdateNotificationDto {
                    @IsOptional() @IsBoolean() read?: boolean;
                    @IsOptional() @IsNumber() version?: number;
                }`
        };

        // 2. Generar colecciones
        const collections: HttpCollection[] = HttpTesterGenerator.generateCollectionsFromController(controllerCode, baseUrl, dtoContents);

        if (collections.length === 0) {
            vscode.window.showWarningMessage('No se detectaron endpoints con @ApiOperation en este controlador. Asegúrate de que usas @ApiOperation.');
            return;
        }

        // 3. Abrir/Mostrar el Webview del HTTP Tester
        HttpTesterPanel.createOrShow(context.extensionUri);

        // 4. Enviar las colecciones al Webview
        // Usamos setTimeout para asegurar que el panel esté cargado antes de enviar la colección
        setTimeout(() => {
            HttpTesterPanel.currentPanel?.loadCollections(collections);
            vscode.window.showInformationMessage(`✅ ${collections.length} colecciones generadas y cargadas.`);
        }, 500);

    } catch (error: any) {
        vscode.window.showErrorMessage(`❌ Error al generar colecciones: ${error.message}`);
    }
}