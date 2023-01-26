# Contributing Guide

This is a guide for how to build the Porter VS Code extension from source and test it locally.
For more general information about contributing to the Porter project, see our [New Contributor Guide](https://getporter.org/contribute/).

---
* [How to help](#how-to-help)
  * [Find an issue](#find-an-issue)
  * [Which branch to use](#which-branch-to-use)  
  * [When to open a pull request](#when-to-open-a-pull-request)
  * [How to get your pull request reviewed fast](#how-to-get-your-pull-request-reviewed-fast)
  * [Signing your commits](#signing-your-commits)
  * [The life of a pull request](#the-life-of-a-pull-request)
* [Contribution Ladder](#contribution-ladder)
* [Developer Tasks](#developer-tasks)
  * [Initial setup](#initial-setup)
  * [Magefile explained](#magefile-explained)
* [How it works](#how-it-works)
---

# How to help

We welcome your contributions and participation! If you aren't sure what to
expect, here are some norms for our project so that you feel more comfortable with
how things will go.

If this is your first contribution to Porter, we have a [tutorial] that walks you
through how to setup your developer environment, make a change and test it.

[tutorial]: https://getporter.org/contribute/tutorial/

## Code of Conduct

The Porter community is governed by our [Code of Conduct][coc].
This includes but isn't limited to: the porter and related mixin repositories,
slack, interactions on social media, project meetings, conferences and meetups.

[coc]: https://getporter.org/src/CODE_OF_CONDUCT.md

## Find an issue

Use the [getporter.org/find-issue] link to find good first issues for new contributors and help wanted issues for our other contributors.

When you have been contributing for a while, take a look at the "Backlog" column on our [project board][board] for high priority issues.
The project board is at the organization level, so it contains issues from across all the Porter repositories. 

* [`good first issues`][good-first-issue] has extra information to help you make your first contribution.
* [`help wanted`][help-wanted] are issues suitable for someone who isn't a core maintainer.
* `hmm 🛑🤔` issues should be avoided. They are not ready to be worked on yet
  because they are not finished being designed or we aren't sure if we want the
  feature, etc.

Maintainers will do their best to regularly make new issues for you to solve and then 
help out as you work on them. 💖

We have a [roadmap] that will give you a good idea of the
larger features that we are working on right now. That may help you decide what
you would like to work on after you have tackled an issue or two to learn how to
contribute to Porter. If you have a big idea for Porter, learn [how to propose
a change to Porter][pep].

When you create your first pull request, add your name to the bottom of our 
[Contributors][contributors] list. Thank you for making Porter better! 🙇‍♀️

[getporter.org/find-issue]: https://getporter.org/find-issue/
[contributors]: https://getporter.org/src/CONTRIBUTORS.md                                          
[good-first-issue]: https://getporter.org/board/good+first+issue
[help-wanted]: https://getporter.org/board/help+wanted
[board]: https://getporter.org/board
[slack]: https://getporter.org/community#slack
[roadmap]: https://getporter.org/src/README.md#roadmap
[pep]: https://getporter.org/contribute/proposals/

## Which branch to use

Unless the issue specifically mentions a branch, please create your feature branch from the **main** branch.

For example:

```
# Make sure you have the most recent changes to main
git checkout main
git pull

# Create a branch based on main named MY_FEATURE_BRANCH
git checkout -b MY_FEATURE_BRANCH main
```

## When to open a pull request

It's OK to submit a PR directly for problems such as misspellings or other
things where the motivation/problem is unambiguous.

If there isn't an issue for your PR, please make an issue first and explain the
problem or motivation for the change you are proposing. When the solution isn't
straightforward, for example, "Implement missing command X", then also outline
your proposed solution. Your PR will go smoother if the solution is agreed upon
before you've spent a lot of time implementing it.

Since Porter is VS Code extension, "solutions" should focus on what the user interface will be, and how the interaction between the user and the extension should look.

## How to test your pull request

We recommend running the following every time before pushing commits to your pull request / branch:

```
npm test
```

## How to get your pull request reviewed fast

🚧 If you aren't done yet, create a draft pull request or put WIP in the title
so that reviewers wait for you to finish before commenting.

1️⃣ Limit your pull request to a single task. Don't tackle multiple unrelated
things, especially refactoring. If you need large refactoring for your change,
chat with a maintainer first, then do it in a separate PR first without any
functionality changes.

🎳 Group related changes into separate commits to make it easier to review. 

😅 Make requested changes in new commits. Please don't amend or rebase commits
that we have already reviewed. When your pull request is ready to merge, you can
rebase your commits yourself, or we can squash when we merge. Just let us know
what you are more comfortable with.

🚀 We encourage [follow-on PRs](#follow-on-pr) and a reviewer may let you know in
their comment if it is okay for their suggestion to be done in a follow-on PR.
You can decide to make the change in the current PR immediately, or agree to
tackle it in a reasonable amount of time in a subsequent pull request. If you
can't get to it soon, please create an issue and link to it from the pull
request comment so that we don't collectively forget.

## Signing your commits

You can automatically sign your commits to meet the DCO requirement for this
project by running the following command: `mage SetupDCO` or just `go run mage.go SetupDCO` if you don't have [mage installed yet](https://getporter.org/src/CONTRIBUTING.md#magefile-explained).
See the [Porter Contributing Tutorial](https://getporter.org/contribute/tutorial) for how to fully set up a working Porter development environment.
The VS Code extension repository uses a different language (typescript) when the rest of Porter uses Go, but some of our developer scripts are common to all repositories and are in Go.

Licensing is important to open source projects. It provides some assurances that
the software will continue to be available based under the terms that the
author(s) desired. We require that contributors sign off on commits submitted to
our project's repositories. The [Developer Certificate of Origin
(DCO)](https://developercertificate.org/) is a way to certify that you wrote and
have the right to contribute the code you are submitting to the project.

You sign-off by adding the following to your commit messages:

```
Author: Your Name <your.name@example.com>
Date:   Thu Feb 2 11:41:15 2018 -0800

    This is my commit message

    Signed-off-by: Your Name <your.name@example.com>
```

Notice the `Author` and `Signed-off-by` lines match. If they don't, the PR will
be rejected by the automated DCO check.

Git has a `-s` command line option to do this automatically:

    git commit -s -m 'This is my commit message'

If you forgot to do this and have not yet pushed your changes to the remote
repository, you can amend your commit with the sign-off by running 

    git commit --amend -s

## The life of a pull request

1. You create a draft or WIP pull request. Reviewers will ignore it mostly
   unless you mention someone and ask for help. Feel free to open one and use
   the pull request to see if the CI passes. Once you are ready for a review,
   remove the WIP or click "Ready for Review" and leave a comment that it's
   ready for review.

   If you create a regular pull request, a reviewer won't wait to review it.
1. A reviewer will assign themselves to the pull request. If you don't see
   anyone assigned after 3 business days, you can leave a comment asking for a
   review, or ping in [slack][slack]. Sometimes we have busy days, sick days,
   weekends and vacations, so a little patience is appreciated! 🙇‍♀️
1. The reviewer will leave feedback.
    * `nits`: These are suggestions that you may decide to incorporate into your pull
      request or not without further comment.
    * It can help to put a 👍 on comments that you have implemented so that you
      can keep track.
    * It is okay to clarify if you are being told to make a change or if it is a
      suggestion.
1. After you have made the changes (in new commits please!), leave a comment. If
   3 business days go by with no review, it is okay to bump.
1. When a pull request has been approved, the reviewer will squash and merge
   your commits. If you prefer to rebase your own commits, at any time leave a
   comment on the pull request to let them know that.

### Follow-on PR

A follow-on PR is a pull request that finishes up suggestions from another pull
request.

When the core of your changes are good, and it won't hurt to do more of the
changes later, our preference is to merge early, and keep working on it in a
subsequent. This allows us to start testing out the changes in our canary
builds, and more importantly enables other developers to immediately start
building their work on top of yours.

This helps us avoid pull requests to rely on other pull requests. It also avoids
pull requests that last for months, and in general we try to not let "perfect be
the enemy of the good". It's no fun to watch your work sit in purgatory, and it
kills contributor momentum.

# Contribution Ladder

Our [contribution ladder][ladder] defines the roles and responsibilities for the Porter
project and how to participate with the goal of moving from a user to a
maintainer.

[ladder]: https://getporter.org/src/CONTRIBUTION_LADDER.md

# Developer Tasks

## Initial setup

We have a [tutorial] that walks you through how to set up your developer
environment for Porter, make a change and test it.
Since this repository uses typescript instead of Go, the setup instructions for the VS Code extension are a bit different:

1. Install npm with a package manager such as homebrew, chocolately or apt.
1. [Install typescript](https://code.visualstudio.com/docs/typescript/typescript-compiling#_install-the-typescript-compiler).
1. Clone the repository with `git clone https://github.com/getporter/vscode-extension.git`.
1. Change to the vs code extension directory, `cd vscode-extension`.
1. Install the packages used by the Porter VS Code extension with `npm install`.
1. Build and test the extension with `npm test`.

If you are planning on contributing back to the project, you'll need to
[fork](https://guides.github.com/activities/forking/) and clone your fork. If
you want to build porter from scratch, you can follow the process above and
clone directly from the project.

## Magefile explained

Porter uses a cross-platform make alternative called [mage](https://magefile.org), where the targets are written in Go.

### Mage Targets

Mage targets are not case-sensitive, but in our docs we use camel case to make
it easier to read. You can run either `mage SetupDCO` or `mage setupdco` for
example.

* **SetupDCO** installs a git commit hook that automatically signs-off your commit
  messages per the DCO requirement.
* **Compile** compiles the extension.
* **Test** runs the test suite.
* **Package** creates a package for the extension that you can distribute and install.

## Test the extension

From inside VS Code while you are editing the source code for the extension, press F5 or from the menu select "Run -> Start Debugging".
A new VS Code window will open with the extension loaded.
Open a directory with a porter bundle, and from there you can manually verify that autocomplete and other features of the extension are working properly.

# How it works

The extension does a lot of things, but some key bits of the logic in the extension are actually **in the porter cli**.
The autocomplete for porter.yaml files works as follows:

1. The extension detects that it is in a porter.yaml file and calls `porter schema`.
1. The schema command returns a json schema for the installation of porter on the local machine. The schema cannot be known beforehand because it's dependent upon the mixins that are installed.
1. The extension detects if the json schema for Porter bundles has changed since last loaded and if so, prompts the user to close and reopen the porter.yaml file.
1. Now we have autocomplete available for the porter.yaml file! 🎉

Other json schema files used by Porter are static, and stored in Porter's main repository in https://github.com/getporter/porter/tree/main/pkg/schema. If you are working on a bug report for the json schema, you may need to edit either on the schema files in that directory, or in the affected mixin's repository. Most of the time, fixes for the extension do not actually require changing the extension itself or releasing a new version of the extension. Instead we fix either the porter cli or a mixin and the user doesn't need to update the extension itself.
