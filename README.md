# Spice

Spice is an experimental debugger that works across time. Rather than step through a program line by line, Spice traces the execution of a whole function at once, such that altering its arguments immediately shows the corresponding changes in its behavior. Spice visualizes control flow and changes in data structures- for example, the values of variables as they change across loop iterations, the path of a pointer as it traverses a graph, or the motion of array elements as they are sorted.

## Building

Spice runs on x86-64 Windows and supports 64-bit binaries built with debug symbols by Visual Studio toolchain v140. It may handle other toolchains or languages with compatible PDBs.

It has two components that need to be built separately, and then combined into a final build. The `final` tag has a number of unmerged fixes required for a release build, so first check it out:

    git checkout final

### Server

The server is written in [Rust](https://www.rust-lang.org) and built with Rust's package manager, Cargo. The default Windows install provides the stable MSVC toolchain; Spice requires a nightly toolchain. This can be configured as part of running `rustup-init.exe`, or after the fact with this command:

    rustup default nightly-x86_64-pc-windows-msvc

Once Rust is installed, the Spice server can be built with this command, run from the `server` directory:

    cargo build --release

### Frontend

The UI is written in TypeScript on Angular. It is built with [`node.js`](https://nodejs.org)'s package manager, `npm` (or [`yarn`](https://yarnpkg.com), if you are so inclined). From the `client` directory, install the dependencies and build the app:

    npm install
    npm run sass
    npm run build:aot

### Packaging

Producing a release build requires one more step. A copy of [Electron](http://electron.atom.io) will be installed in `client/node_modules/electron/dist`. Make a copy of that directory, create the directory `resources/app`, and copy in the following files:

* `package.json`
* `main.js`
* `index.aot.html` - rename it to `index.html`
* `bundle.js` - created by `npm run build:aot`
* `spice.css` - created by `npm run build:aot`
* `prism_light.css`
* `prism_dark.css`
* `images/favicon.png`
* `oboe-browser.min.js` - from `node-modules/oboe/dist`
* `shim.min.js` - from `node_modules/core-js/client`
* `zone.min.js` - from `node_modules/zone.js/dist`

Finally, copy `server/target/release/server.exe` next to `electron.exe`.

## Development

While working on spice, the server and frontend can be built and run separately, without Electron and without the fixes in the `final` tag.

The server can be built and run in debug mode:

    cargo run

The frontend can run in a browser with live reloading:

    npm run start

### Documentation

Source code documentation can be generated for the server with this command:

    cargo doc

The protocol between the frontend and the server is documented in more detail in `docs/api/v1.md`.
