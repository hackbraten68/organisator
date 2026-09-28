var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import salesforce from '@salesforce/vite-plugin-ui-bundle';
import codegen from 'vite-plugin-graphql-codegen';
import { getOrgInfo, refreshOrgAuth } from '@salesforce/ui-bundle/app';
var schemaPath = resolve(__dirname, '../../../../../schema.graphql');
var schemaExists = existsSync(schemaPath);
/**
 * `@salesforce/vite-plugin-ui-bundle` serves `/services/data/**` through
 * `orgInfo.instanceUrl`, which `getOrgInfo` rewrites to the Lightning domain
 * (`*.lightning.force.com`). That domain rejects the Platform SDK's GraphQL
 * endpoint with `401 UNAUTHORIZED_EXCEPTION: Session expired or invalid token
 * usage`, while the plain instance URL answers `200` for the identical request
 * — the plugin's own `handleGraphQL`, frontdoor and file-upload handlers all
 * use `rawInstanceUrl` for the same reason. Its generic REST handler does not,
 * so every `POST /services/data/vXX/graphql` fails in local dev.
 *
 * Rather than patch the plugin, this middleware claims that single route first
 * (`enforce: 'pre'` + array order) and forwards it to `rawInstanceUrl`. All
 * other org routes keep the plugin's behaviour, which is verified working.
 */
var SDK_GRAPHQL_ROUTE = /^\/services\/data\/v\d{2}\.\d\/graphql$/;
function createOrgGraphqlProxy() {
    var orgInfo;
    return {
        name: 'organisator:org-graphql-proxy',
        enforce: 'pre',
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                var url, route, chunks, chunk, e_1_1, body_1, search_1, forward, target, _a, response, refreshed, _b, _c, error_1;
                var _d, req_1, req_1_1;
                var _e, e_1, _f, _g;
                var _h, _j;
                return __generator(this, function (_k) {
                    switch (_k.label) {
                        case 0:
                            url = (_h = req.url) !== null && _h !== void 0 ? _h : '/';
                            route = url.split('?')[0];
                            if (!SDK_GRAPHQL_ROUTE.test(route)) {
                                next();
                                return [2 /*return*/];
                            }
                            _k.label = 1;
                        case 1:
                            _k.trys.push([1, 22, , 23]);
                            chunks = [];
                            _k.label = 2;
                        case 2:
                            _k.trys.push([2, 7, 8, 13]);
                            _d = true, req_1 = __asyncValues(req);
                            _k.label = 3;
                        case 3: return [4 /*yield*/, req_1.next()];
                        case 4:
                            if (!(req_1_1 = _k.sent(), _e = req_1_1.done, !_e)) return [3 /*break*/, 6];
                            _g = req_1_1.value;
                            _d = false;
                            chunk = _g;
                            chunks.push(chunk);
                            _k.label = 5;
                        case 5:
                            _d = true;
                            return [3 /*break*/, 3];
                        case 6: return [3 /*break*/, 13];
                        case 7:
                            e_1_1 = _k.sent();
                            e_1 = { error: e_1_1 };
                            return [3 /*break*/, 13];
                        case 8:
                            _k.trys.push([8, , 11, 12]);
                            if (!(!_d && !_e && (_f = req_1.return))) return [3 /*break*/, 10];
                            return [4 /*yield*/, _f.call(req_1)];
                        case 9:
                            _k.sent();
                            _k.label = 10;
                        case 10: return [3 /*break*/, 12];
                        case 11:
                            if (e_1) throw e_1.error;
                            return [7 /*endfinally*/];
                        case 12: return [7 /*endfinally*/];
                        case 13:
                            body_1 = Buffer.concat(chunks).toString('utf8');
                            search_1 = url.slice(route.length);
                            forward = function (target) {
                                return fetch("".concat(target.rawInstanceUrl).concat(route).concat(search_1), {
                                    method: req.method,
                                    headers: {
                                        'Content-Type': 'application/json',
                                        Accept: 'application/json',
                                        'X-Chatter-Entity-Encoding': 'false',
                                        // `sid` is what Apex/UI API expects; the bearer token covers
                                        // plain REST. Both must carry the same session.
                                        Cookie: "sid=".concat(target.accessToken),
                                        Authorization: "Bearer ".concat(target.accessToken),
                                    },
                                    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body_1,
                                });
                            };
                            if (!(orgInfo !== null && orgInfo !== void 0)) return [3 /*break*/, 14];
                            _a = orgInfo;
                            return [3 /*break*/, 16];
                        case 14: return [4 /*yield*/, getOrgInfo()];
                        case 15:
                            _a = (orgInfo = _k.sent());
                            _k.label = 16;
                        case 16:
                            target = _a;
                            if (!target) {
                                res.statusCode = 401;
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({
                                    errorCode: 'UNAUTHORIZED',
                                    message: 'No org authenticated. Run "sf org login" or "sf config set target-org=<alias>".',
                                }));
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, forward(target)];
                        case 17:
                            response = _k.sent();
                            if (!(response.status === 401 || response.status === 403)) return [3 /*break*/, 20];
                            return [4 /*yield*/, refreshOrgAuth(target.orgAlias || target.username)];
                        case 18:
                            refreshed = _k.sent();
                            if (!refreshed) return [3 /*break*/, 20];
                            target = orgInfo = refreshed;
                            return [4 /*yield*/, forward(target)];
                        case 19:
                            response = _k.sent();
                            _k.label = 20;
                        case 20:
                            res.statusCode = response.status;
                            res.setHeader('Content-Type', (_j = response.headers.get('content-type')) !== null && _j !== void 0 ? _j : 'application/json');
                            _c = (_b = res).end;
                            return [4 /*yield*/, response.text()];
                        case 21:
                            _c.apply(_b, [_k.sent()]);
                            return [3 /*break*/, 23];
                        case 22:
                            error_1 = _k.sent();
                            next(error_1);
                            return [3 /*break*/, 23];
                        case 23: return [2 /*return*/];
                    }
                });
            }); });
        },
    };
}
export default defineConfig(function (_a) {
    var mode = _a.mode;
    return {
        base: './',
        plugins: __spreadArray([
            tailwindcss(),
            react(),
            createOrgGraphqlProxy(),
            salesforce()
        ], (schemaExists
            ? [
                codegen({
                    configFilePathOverride: resolve(__dirname, 'codegen.yml'),
                    runOnStart: true,
                    runOnBuild: true,
                    enableWatcher: true,
                    throwOnBuild: true,
                }),
            ]
            : []), true),
        // Build configuration for MPA
        build: {
            outDir: resolve(__dirname, 'dist'),
            assetsDir: 'assets',
            sourcemap: false,
        },
        // Resolve aliases (shared between build and test)
        resolve: {
            dedupe: ['react', 'react-dom'],
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@api': path.resolve(__dirname, './src/api'),
                '@components': path.resolve(__dirname, './src/components'),
                '@utils': path.resolve(__dirname, './src/utils'),
                '@styles': path.resolve(__dirname, './src/styles'),
                '@assets': path.resolve(__dirname, './src/assets'),
            },
        },
        // Vitest configuration
        test: {
            // Override root for tests (build uses src/pages as root)
            root: resolve(__dirname),
            // Use jsdom environment for React component testing
            environment: 'jsdom',
            // Setup files to run before each test
            setupFiles: ['./src/test/setup.ts'],
            // Global test patterns
            include: [
                'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
                'src/**/__tests__/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            ],
            // Coverage configuration
            coverage: {
                provider: 'v8',
                reporter: ['text', 'html', 'clover', 'json'],
                exclude: [
                    'node_modules/',
                    'src/test/',
                    'src/**/*.d.ts',
                    'src/main.tsx',
                    'src/vite-env.d.ts',
                    'src/components/**/index.ts',
                    '**/*.config.ts',
                    'build/',
                    'dist/',
                    'coverage/',
                    'eslint.config.js',
                ],
                thresholds: {
                    global: {
                        branches: 85,
                        functions: 85,
                        lines: 85,
                        statements: 85,
                    },
                },
            },
            // Test timeout
            testTimeout: 10000,
            // Globals for easier testing
            globals: true,
        },
    };
});
