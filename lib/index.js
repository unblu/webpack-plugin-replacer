// import { SourceMapConsumer } from 'source-map';
// import { SourceMapSource, RawSource } from 'webpack-sources';
// import ModuleFilenameHelpers from 'webpack/lib/ModuleFilenameHelpers';
const ReplaceSource = require('webpack-sources').ReplaceSource;
const RawSource = require('webpack-sources').RawSource;
const ModuleFilenameHelpers = require('webpack').ModuleFilenameHelpers;

const TARGET_MODULES = 'MODULES';
const TARGET_CHUNKS = 'CHUNKS';
const SUPPORTED_TARGETS = [TARGET_MODULES, TARGET_CHUNKS];

class Replacer {
    constructor(opts) {
        this.options = Object.assign({sourceMap: true, target: TARGET_CHUNKS, patterns: []}, opts);
    }

    apply(compiler) {
        compiler.plugin('compilation', compilation => {
            if (this.options.sourceMap) {
                compilation.plugin('build-module', (moduleArg) => {
                    // to get detailed location info about errors
                    moduleArg.useSourceMap = true;
                });
            }

            if (this.options.target === TARGET_MODULES) {
                compilation.plugin('optimize-modules', (modules) => {
                    modules.forEach(module => {
                        if(module.constructor.name === "NormalModule") {
                            // console.log("Module: ", module.resource);
                            for (const pattern of this.options.patterns) {
                                module._source._value = module._source._value.replace(pattern.regex, pattern.value);
                            }
                        } else if(module.constructor.name === "MultiModule") {
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
                compilation.plugin('optimize-chunk-assets', (chunks, callback) => {
                    chunks.reduce((acc, chunk) => acc.concat(chunk.files || []), [])
                        .concat(compilation.additionalChunkAssets || [])
                        .filter(ModuleFilenameHelpers.matchObject.bind(null, this.options))
                        .forEach((file) => {
                            // console.log("File: ", file);
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
                        });
                    callback();
                });
            } else {
                throw "Unsupported target type! Type: '" + this.options.target + "'; Supported types: [" + SUPPORTED_TARGETS + "];";
            }
        });
    }
}

Replacer.TARGET_MODULES = TARGET_MODULES;
Replacer.TARGET_CHUNKS = TARGET_CHUNKS;
Replacer.SUPPORTED_TARGETS = SUPPORTED_TARGETS;

module.exports = Replacer;
