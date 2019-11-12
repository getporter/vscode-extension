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

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
