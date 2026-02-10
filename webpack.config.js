const path = require("path");

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "content/scripts"),
    filename: "zotero-search-replace-bundled.js",
    library: {
      type: "module",
    },
  },
  mode: "production",
  devtool: false,
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: {
                    browsers: ["firefox-esr115"],
                  },
                  modules: false,
                },
              ],
            ],
          },
        },
      },
    ],
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    extensions: [".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
};
