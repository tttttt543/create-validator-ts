import globWatch from "glob-watcher";
import _fs from "fs";
import * as globby from "globby";
import assert from "assert";
import { generateValidator } from "./create-ts-validator";
import { validatorCodeGenerator } from "./validator-code-generator";

export { GenerateValidatorCodeOptions, validatorCodeGenerator } from "./validator-code-generator";
// TODO: Node 14+
const fs = _fs.promises;
export type CreateTSValidatorOptions = {
    cwd: string;
    verbose: boolean;
    tsconfigFilePath: string;
    codeGeneratorScript: string;
    targetGlobs: string[];
};

export async function watchValidator(options: CreateTSValidatorOptions) {
    const { generator } = (await import(options.codeGeneratorScript)) as { generator: validatorCodeGenerator };
    const watcher = globWatch(options.targetGlobs, {
        ignoreInitial: true
    });
    watcher.on("change", async (filePath) => {
        const result = await generateValidator({
            cwd: options.cwd,
            filePath: filePath,
            tsconfigFilePath: options.tsconfigFilePath,
            validatorGenerator: generator
        });
        if (!result) {
            return;
        }
        if (options.verbose) {
            console.log("Update validator: " + result.validatorFilePath);
        }
        return fs.writeFile(result.validatorFilePath, result.code, "utf-8");
    });
}

// --check: validate the difference current of source
export async function testGeneratedValidator(options: CreateTSValidatorOptions) {
    const files = globby.sync(options.targetGlobs, {
        cwd: options.cwd,
        absolute: true
    });
    const { generator } = (await import(options.codeGeneratorScript)) as { generator: validatorCodeGenerator };
    return Promise.all(
        files.map(async (filePath) => {
            const result = await generateValidator({
                cwd: options.cwd,
                filePath: filePath,
                tsconfigFilePath: options.tsconfigFilePath,
                validatorGenerator: generator
            });
            if (!result) {
                return;
            }
            try {
                await fs.access(result.validatorFilePath);
            } catch {
                return;
            }
            const oldValidatorCode = await fs.readFile(result.validatorFilePath, "utf-8");
            try {
                assert.strictEqual(oldValidatorCode, result.code);
            } catch (error) {
                console.error(
                    "Found diff between types and validator.\nPlease update validator: $ npx create-ts-validator " +
                        filePath
                );
                throw error;
            }
            if (options.verbose) {
                console.log("OK: " + filePath);
            }
        })
    );
}

export async function createValidator(options: CreateTSValidatorOptions) {
    const { generator } = (await import(options.codeGeneratorScript)) as { generator: validatorCodeGenerator };
    const files = globby.sync(options.targetGlobs, {
        cwd: options.cwd,
        absolute: true
    });
    return Promise.all(
        files.map(async (filePath) => {
            const result = await generateValidator({
                cwd: options.cwd,
                filePath: filePath,
                tsconfigFilePath: options.tsconfigFilePath,
                validatorGenerator: generator
            });
            if (!result) {
                return;
            }
            if (options.verbose) {
                console.log("Create: " + filePath);
            }
            return fs.writeFile(result.validatorFilePath, result.code, "utf-8");
        })
    );
}