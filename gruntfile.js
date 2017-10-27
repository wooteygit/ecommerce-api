module.exports = function(grunt) {
    "use strict";

    grunt.initConfig({
        ts: {
            default: {
                watch: ".",
                src: ["src/**/*.ts", "!src/.baseDir.ts"],
                dest: "./dist",
                options: {
                    module: "commonjs",
                    target: "es6",
                    sourceMap: true
                }
            }
        }
    });

    grunt.loadNpmTasks("grunt-ts");
    grunt.registerTask("default", ["ts"]);
};
