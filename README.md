# Visual Studio Code Porter Tools

This extension helps you to build Cloud Native Application Bundles (CNAB) with Porter.  Features
include:

* Create a Porter project
* Create and organise bundle installation steps
* Build your Porter project into a bundle
* Install a Porter bundle
* Code completion and error checking for the Porter manifest
* Navigation around the Porter manifest (Go To Definition and Find References)

For more about Porter see https://porter.sh/.

## Prerequisites

You will need the Porter binary on your system PATH.  If you don't have this, you can download
it from https://porter.sh/install/.

If you have the Porter binary but it's not on your path, you can specify the file path
using the `vscode-porter > porter-path` configuration setting.  This must include the
full file path, not just the directory (and must include the `.exe` extension on Windows).

## Telemetry

This extension collects telemetry data to help us build a better experience for building
bundles with Porter and VS Code. We only collect the following data:

* Which commands are executed
* Whether a command succeeded or failed

We do not collect any information about image names, paths, error messages, etc. The extension respects
the `telemetry.enableTelemetry` setting which you can learn more about in our
[FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## Contributing

This project welcomes contributions and suggestions.

For contributions in the form of pull requests, a DCO sign-off is required.
See [Signing your commits](https://porter.sh/src/CONTRIBUTING.md#signing-your-commits)
for details on this requirement.

This project adheres to [Porter's Code of Conduct](https:/porter.sh/src/CODE_OF_CONDUCT.md).
