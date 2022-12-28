const ReplaceSource = require('webpack-sources').ReplaceSource;
const RawSource = require('webpack-sources').RawSource;
const Compilation = require('webpack').Compilation;

const TARGET_MODULES = 'MODULES';
const TARGET_ASSETS = 'ASSETS';
const TARGET_AFTER_ASSETS = 'AFTER-ASSETS';
const SUPPORTED_TARGETS = [TARGET_MODULES, TARGET_ASSETS, TARGET_AFTER_ASSETS];

class Replacer {
    constructor(opts) {
        console.log("Unblu WebpackPluginReplacer (v5.1.1) created.");
        this.options = Object.assign({sourceMap: true, target: TARGET_AFTER_ASSETS, patterns: []}, opts);
    }

    replaceInChunks(compilation, chunks) {
        const assetList = Object.keys(chunks);
        assetList.filter((file) => {
            const asset = compilation.assets[file];
            let outputSource;
            if (this.options.sourceMap && asset.sourceAndMap) {
                const {source, map} = asset.sourceAndMap();
                const resultSource = new ReplaceSource(asset);

                for (const index in this.options.patterns) {
                    const pattern = this.options.patterns[index];
                    if ((pattern.targetFilenamePattern !== undefined && file.match(pattern.targetFilenamePattern)) ||
                        (pattern.targetSuffix !== undefined && file.endsWith(pattern.targetSuffix))) {
                        console.log(`Unblu WebpackPluginReplacer process file with pattern with sourcemap: ${file}, regex: ${pattern.regex}, description: ${pattern.description}`);
                        let match = null;
                        while ((match = pattern.regex.exec(source)) !== null) {
                            resultSource.replace(match.index, match.index + match[0].length - 1, typeof pattern.value === 'function' ? pattern.value(match) : pattern.value);
                        }
                    }
                }
                outputSource = resultSource;
            } else {
                let code = asset.source();
                for (const pattern of this.options.patterns) {
                    if ((pattern.targetFilenamePattern !== undefined && file.match(pattern.targetFilenamePattern)) ||
                        (pattern.targetSuffix !== undefined && file.endsWith(pattern.targetSuffix))) {
                        console.log(`Unblu WebpackPluginReplacer process file with pattern: ${file}, regex: ${pattern.regex}, description: ${pattern.description}`);
                        code = code.replace(pattern.regex, pattern.value);
                    }
                }
                outputSource = new RawSource(code);
            }
            compilation.assets[file] = outputSource;
        });
    }

    apply(compiler) {
        compiler.hooks.compilation.tap('WebpackPluginReplacer', (compilation) => {
            if (this.options.sourceMap) {
                compilation.hooks.buildModule.tap('WebpackPluginReplacer', (moduleArg) => {
                    // to get detailed location info about errors
                    moduleArg.useSourceMap = true;
                });
            }

            if (this.options.target === TARGET_MODULES) {
                compilation.hooks.optimizeModules.tap('WebpackPluginReplacer', (modules) => {
                    modules.forEach(module => {
                        if (module.constructor.name === "NormalModule") {
                            // console.log("Module: ", module.resource);
                            for (const pattern of this.options.patterns) {
                                module._source._value = module._source._value.replace(pattern.regex, pattern.value);
                            }
                        } else if (module.constructor.name === "MultiModule") {
                            for (const dep of module.dependencies) {
                                for (const pattern of this.options.patterns) {
                                    dep.module._source._value = dep.module._source._value.replace(pattern.regex, pattern.value);
                                }
                            }
                        } else {
                            console.warn("unsupported module type for replacing module sources!", module);
                        }
                    });
                });
            } else if (this.options.target === TARGET_ASSETS) {
                compilation.hooks.processAssets.tap({ name: 'WebpackPluginReplacer', stage: Compilation.PROCESS_ASSETS_STAGE_REPORT, additionalAssets: true }, (chunks) => {
                    console.log("compilation.hooks.processAssets called.")
                    this.replaceInChunks(compilation, chunks);
                });
            } else if(this.options.target === TARGET_AFTER_ASSETS) {
                compilation.hooks.afterProcessAssets.tap({ name: 'WebpackPluginReplacer', stage: Compilation.PROCESS_ASSETS_STAGE_REPORT, additionalAssets: true }, (chunks) => {
                    console.log("compilation.hooks.afterProcessAssets called.");
                    this.replaceInChunks(compilation, chunks);
                });
            } else {
                throw "Unsupported target type! Type: '" + this.options.target + "'; Supported types: [" + SUPPORTED_TARGETS + "];";
            }
        });
    }
}

Replacer.TARGET_MODULES = TARGET_MODULES;
Replacer.TARGET_ASSETS = TARGET_ASSETS;
Replacer.TARGET_AFTER_ASSETS = TARGET_AFTER_ASSETS;
Replacer.SUPPORTED_TARGETS = SUPPORTED_TARGETS;

module.exports = Replacer;
