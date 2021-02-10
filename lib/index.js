const ReplaceSource = require('webpack-sources').ReplaceSource;
const RawSource = require('webpack-sources').RawSource;
const Compilation = require('webpack').Compilation;

const TARGET_MODULES = 'MODULES';
const TARGET_CHUNKS = 'CHUNKS';
const TARGET_AFTER_CHUNKS = 'AFTER-CHUNKS';
const SUPPORTED_TARGETS = [TARGET_MODULES, TARGET_CHUNKS, TARGET_AFTER_CHUNKS];

class Replacer {
    constructor(opts) {
        console.log("Unblu WebpackPluginReplacer created.");
        this.options = Object.assign({sourceMap: true, target: TARGET_AFTER_CHUNKS, patterns: []}, opts);
    }

    replaceInChunks(compilation, chunks) {
        for (let file in compilation.assets) {
            console.log("Unblu WebpackPluginReplacer file: ", file);
            const asset = compilation.assets[file];
            let outputSource;
            if (this.options.sourceMap && asset.sourceAndMap) {
                const {source, map} = asset.sourceAndMap();
                const resultSource = new ReplaceSource(asset);

                for (const index in this.options.patterns) {
                    const pattern = this.options.patterns[index];

                    let match = null;
                    while ((match = pattern.regex.exec(source)) !== null) {
                        resultSource.replace(match.index, match.index + match[0].length - 1, typeof pattern.value === 'function' ? pattern.value(match) : pattern.value);
                    }
                }
                outputSource = resultSource;
            } else {
                let code = asset.source();
                for (const pattern of this.options.patterns) {
                    code = code.replace(pattern.regex, pattern.value);
                }
                outputSource = new RawSource(code);
            }

            compilation.assets[file] = outputSource;
        }
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
            } else if (this.options.target === TARGET_CHUNKS) {
                compilation.hooks.processAssets.tap({ name: 'WebpackPluginReplacer', stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE, additionalAssets: true }, (chunks) => {
                    console.log("compilation.hooks.optimizeChunks called.")
                    this.replaceInChunks(compilation, chunks);
                });
            } else if(this.options.target === TARGET_AFTER_CHUNKS) {
                compilation.hooks.processAssets.tap({ name: 'WebpackPluginReplacer', stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE, additionalAssets: true }, (chunks) => {
                    console.log("compilation.hooks.afterOptimizeChunks called.");
                    this.replaceInChunks(compilation, chunks);
                });
            } else {
                throw "Unsupported target type! Type: '" + this.options.target + "'; Supported types: [" + SUPPORTED_TARGETS + "];";
            }
        });
    }
}

Replacer.TARGET_MODULES = TARGET_MODULES;
Replacer.TARGET_CHUNKS = TARGET_CHUNKS;
Replacer.TARGET_AFTER_CHUNKS = TARGET_AFTER_CHUNKS;
Replacer.SUPPORTED_TARGETS = SUPPORTED_TARGETS;

module.exports = Replacer;
