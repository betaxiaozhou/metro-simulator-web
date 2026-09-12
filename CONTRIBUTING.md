# Contributing to Metro Simulator

Thank you for your interest in contributing to **Metro Simulator**.

Contributions of all kinds are welcome, including bug reports, feature suggestions, documentation improvements, code changes, testing, and research related to metro systems and railway operations.

Please read this guide before opening an issue or pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Before You Start](#before-you-start)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Discussions](#discussions)
- [Development Workflow](#development-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Developer Certificate of Origin](#developer-certificate-of-origin)
- [Pull Requests](#pull-requests)
- [Technical and Simulation Accuracy](#technical-and-simulation-accuracy)
- [Assets and Copyright](#assets-and-copyright)
- [Security Vulnerabilities](#security-vulnerabilities)
- [Licensing](#licensing)

---

## Code of Conduct

Please keep all interactions respectful, constructive, and relevant to the project.

Disagreement about implementation details, simulation accuracy, or technical decisions is welcome, but personal attacks, harassment, spam, and deliberately disruptive behavior are not.

Project maintainers may moderate or remove content that interferes with productive collaboration.

---

## Ways to Contribute

You can contribute by:

- Reporting bugs
- Suggesting new features
- Improving documentation
- Fixing code
- Improving UI or accessibility
- Improving simulation logic
- Providing technical references
- Testing existing features
- Reviewing pull requests
- Improving railway or metro operation accuracy
- Reporting outdated or incorrect data

Not every contribution needs to include code.

---

## Before You Start

Before opening a new issue or pull request:

1. Search existing Issues and Discussions to avoid duplicates.
2. Check whether the problem has already been fixed in the latest version.
3. Make sure your contribution is relevant to Metro Simulator.
4. For significant changes, consider opening an Issue or Discussion first.

For major architectural changes or large new features, please discuss the proposal before investing substantial development time.

This helps avoid situations where a large pull request cannot be accepted because its design conflicts with the project's direction.

---

## Reporting Bugs

Please use GitHub Issues for reproducible bugs.

A useful bug report should include:

- A clear description of the problem
- Steps to reproduce it
- Expected behavior
- Actual behavior
- Browser, operating system, or device information when relevant
- Screenshots or screen recordings when useful
- Console errors or logs when available
- The Metro Simulator version or commit where the issue occurred

Please avoid vague reports such as:

> It doesn't work.

Instead, provide enough information for another person to reproduce the problem.

### Security bugs are different

Do **not** publicly report security vulnerabilities through normal Issues.

See [Security Vulnerabilities](#security-vulnerabilities).

---

## Suggesting Features

Feature requests are welcome.

A good feature request should explain:

- What problem the feature solves
- How the proposed feature would work
- Why it belongs in Metro Simulator
- Whether it is based on a real metro or railway operation
- Any relevant technical references
- Possible alternatives

For broader ideas or concepts that are not yet ready to become development tasks, GitHub Discussions may be more appropriate.

---

## Discussions

GitHub Discussions should generally be used for:

- Questions
- Ideas
- General project discussion
- Simulation concepts
- Railway or metro operation discussions
- Community feedback
- Showcases

GitHub Issues should generally be used for:

- Confirmed bugs
- Specific feature requests
- Trackable development tasks

As a simple rule:

> **Discussion = conversation**

> **Issue = actionable task**

---

# Development Workflow

## 1. Fork the repository

Fork the repository to your own GitHub account.

Then clone your fork:

```bash
git clone https://github.com/YOUR-USERNAME/metro-simulator-web.git
cd metro-simulator-web
```

Add the upstream repository:

```bash
git remote add upstream https://github.com/ORIGINAL-OWNER/metro-simulator-web.git
```

---

## 2. Create a branch

Do not make normal development changes directly on `main`.

Create a descriptive branch:

```bash
git switch -c feature/ato-speed-supervision
```

Examples:

```text
feature/ato-speed-supervision
fix/emergency-brake-reset
docs/controller-documentation
refactor/train-state-model
```

Avoid names such as:

```text
test
new
fix2
temp
aaa
```

---

## 3. Keep your branch current

Before submitting a pull request, update your local repository when appropriate:

```bash
git fetch upstream
git rebase upstream/main
```

Resolve any conflicts before opening or updating the pull request.

---

# Commit Guidelines

Commits should be understandable and reasonably focused.

Good examples:

```text
Add ATO speed supervision
Fix emergency brake reset logic
Improve station announcement timing
Update controller documentation
Refactor ATP state handling
```

Avoid commit messages such as:

```text
fix
fix again
test
update
aaa
final
final2
really final
```

A commit should ideally represent one meaningful logical change.

Very small development commits are acceptable while working on a branch, because pull requests may later be squash-merged.

---

## Developer Certificate of Origin

Metro Simulator uses the **Developer Certificate of Origin (DCO)**.

The DCO is a declaration that you have the right to submit your contribution to this project.

By signing off a commit, you certify that your contribution complies with the Developer Certificate of Origin.

The full DCO text is available at:

https://developercertificate.org/

### Signing off commits

Every contributed commit must contain a `Signed-off-by` line.

The easiest way to add it is:

```bash
git commit -s -m "Add ATO speed supervision"
```

This produces a commit similar to:

```text
Add ATO speed supervision

Signed-off-by: Your Name <your-email@example.com>
```

The sign-off should use an identity associated with the commit author.

### If you forgot to sign off

For the latest commit:

```bash
git commit --amend --signoff --no-edit
```

Then update your branch:

```bash
git push --force-with-lease
```

Do not use plain `--force` unless you understand the consequences.

### DCO sign-off is not cryptographic signing

These are different:

```bash
git commit -s
```

adds a DCO sign-off.

```bash
git commit -S
```

cryptographically signs a commit using GPG or SSH.

Both may be used together:

```bash
git commit -s -S -m "Add ATO speed supervision"
```

---

# Pull Requests

Pull requests should be focused and reviewable.

Before submitting a pull request:

- Make sure the project builds or runs correctly
- Test the affected functionality
- Remove temporary debugging code
- Remove unnecessary console output
- Update documentation when behavior changes
- Make sure commits meet DCO requirements
- Check that automated tests and status checks pass

A pull request description should explain:

1. What changed
2. Why the change is needed
3. How it was tested
4. Any known limitations
5. Related Issues

For example:

```markdown
## Summary

Adds basic ATO speed supervision.

## Changes

- Adds target-speed tracking
- Adds braking intervention logic
- Updates the train state model

## Testing

Tested manually under normal acceleration and braking conditions.

## Related issue

Closes #123
```

Whenever possible, link the corresponding Issue.

Use keywords such as:

```text
Closes #123
Fixes #123
Resolves #123
```

when the pull request fully resolves the issue.

---

## Pull Request Scope

Please avoid combining unrelated changes into one pull request.

For example, this is usually not ideal:

```text
Add ATO system
Redesign settings page
Update README
Change audio engine
Fix three unrelated bugs
```

Separate changes are easier to review, test, revert, and maintain.

---

## Pull Request Review

Submitting a pull request does not guarantee that it will be merged.

Maintainers may request:

- Design changes
- Additional testing
- Documentation updates
- Smaller scope
- More reliable technical sources
- Refactoring
- Licensing clarification

A pull request may also be declined if it conflicts with the project's direction or architecture.

This is not necessarily a judgment on the quality of the contribution.

---

# Technical and Simulation Accuracy

Metro Simulator aims to represent metro and railway systems with a reasonable degree of technical realism.

When implementing features based on real-world railway systems, contributors are encouraged to provide reliable references.

Examples include:

- Official operator documents
- Government standards
- National or industry standards
- Manufacturer documentation
- Technical manuals that may legally be referenced
- Academic publications
- Reliable photographs or videos
- Publicly available technical information

For simulation behavior involving systems such as:

- ATO
- ATP
- Train protection
- Braking
- Door control
- Driver controls
- Signalling
- Train announcements
- Operating procedures

please clearly distinguish between:

1. documented real-world behavior;
2. reasonable simulation approximations;
3. fictional or gameplay-oriented behavior.

Do not present speculation as an official operating procedure.

---

# Assets and Copyright

Code and non-code assets may have different licensing requirements.

Do not submit content that you do not have the legal right to redistribute.

This includes, but is not limited to:

- Photographs
- Audio recordings
- Train announcement audio
- Logos
- Maps
- Textures
- 3D models
- Fonts
- Operator graphics
- Diagrams
- Documents
- Proprietary software resources

Do not copy assets from commercial games, proprietary simulators, leaked internal systems, or other copyrighted sources without authorization.

When contributing third-party material, clearly identify:

- The original source
- The author or rights holder
- The applicable license
- Any attribution requirements

If the licensing status is unclear, do not include the material until it has been reviewed.

---

## Trademarks

Names, logos, and trademarks belonging to railway operators, manufacturers, government agencies, or other organizations remain the property of their respective owners.

Use of a real-world name in the project does not imply endorsement, sponsorship, or official affiliation.

Contributors should avoid introducing branding in ways that could misleadingly imply an official relationship.

---

# Security Vulnerabilities

Please **do not publicly disclose security vulnerabilities in Issues or Discussions**.

Security vulnerabilities should be reported according to the repository's `SECURITY.md` policy or through GitHub's private security reporting mechanism when available.

Examples include:

- Authentication vulnerabilities
- Authorization bypasses
- Credential exposure
- Injection vulnerabilities
- Cross-site scripting
- Sensitive information disclosure
- Dependency vulnerabilities with meaningful exploitability
- Infrastructure or deployment security issues

Normal application bugs that do not have security implications should continue to use GitHub Issues.

---

# Generated Code and AI-Assisted Contributions

AI-assisted contributions are allowed, but contributors remain responsible for everything they submit.

Before submitting AI-generated or AI-assisted code:

- Review the code yourself
- Test it
- Make sure you understand what it does
- Check for security problems
- Verify licensing and provenance
- Remove fabricated references or APIs
- Ensure it complies with this project's requirements

Using an AI tool does not transfer responsibility for the contribution to the tool.

The contributor signing off the commit remains responsible for the submitted contribution.

---

# Dependencies

Avoid adding new dependencies without a clear reason.

When introducing a dependency, consider:

- Maintenance status
- Security history
- License compatibility
- Bundle size
- Performance impact
- Whether the same result can reasonably be achieved without it

Large or foundational dependencies should normally be discussed before being introduced.

---

# Licensing

By contributing to this repository, you agree that your contribution may be distributed under the license applicable to the relevant part of the project.

Unless otherwise stated, source code contributions are licensed under the repository's primary software license.

Certain assets or resources may be distributed under separate terms. Refer to the repository's licensing documentation for details.

You must not submit material whose license is incompatible with the project.

---

# Questions

If you are unsure whether something should be submitted as an Issue, Discussion, or Pull Request, feel free to open a Discussion first.

Thank you for helping improve Metro Simulator.
