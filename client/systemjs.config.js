/**
 * System configuration for Angular samples
 * Adjust as necessary for your application needs.
 */
(function (global) {
    System.config({
        paths: {
            // paths serve as alias
            'npm:': 'node_modules/'
        },
        // map tells the System loader where to look for things
        map: {
            // our app is within the app folder
            app: 'app',

            // angular bundles
			'@angular/animations': 'npm:@angular/animations/bundles/animations.umd.js',
			'@angular/animations/browser': 'npm:@angular/animations/bundles/animations-browser.umd.js',
			'@angular/platform-browser/animations': 'npm:@angular/platform-browser/bundles/platform-browser-animations.umd.js',   
            '@angular/common': 'npm:@angular/common/bundles/common.umd.js',
            '@angular/compiler': 'npm:@angular/compiler/bundles/compiler.umd.js',
            '@angular/core': 'npm:@angular/core/bundles/core.umd.js',
            '@angular/flex-layout': 'npm:@angular/flex-layout/bundles/flex-layout.umd.js',
            '@angular/forms': 'npm:@angular/forms/bundles/forms.umd.js',
            '@angular/http': 'npm:@angular/http/bundles/http.umd.js',
            '@angular/material': 'npm:@angular/material/bundles/material.umd.js',
            '@angular/platform-browser': 'npm:@angular/platform-browser/bundles/platform-browser.umd.js',
            '@angular/platform-browser-dynamic': 'npm:@angular/platform-browser-dynamic/bundles/platform-browser-dynamic.umd.js',
            '@angular/router': 'npm:@angular/router/bundles/router.umd.js',
            //mock
            '@angular/http/testing': 'npm:@angular/http/bundles/http-testing.umd.js',

            // other libraries
            'rxjs': 'npm:rxjs',
            'hammerjs': 'npm:hammerjs/hammer.js',
            'prismjs' : 'npm:prismjs',
            'angular-in-memory-web-api': 'npm:angular-in-memory-web-api/bundles/in-memory-web-api.umd.js',
            'd3': 'npm:d3',
        },
        // packages tells the System loader how to load when no filename and/or no extension
        packages: {
            app: {
                main: './main.js',
                defaultExtension: 'js'
            },
            rxjs: {
                defaultExtension: 'js'
            },
            d3: {
                main: 'build/d3.js',
                defaultExtension: 'js'
            },
            prismjs: {
                main: 'prism.js',
                defaultExtenstion: 'js'
            }
        }
    });
})(this);
