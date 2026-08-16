# Security Policy

ACC is an **open-source, agentic-driven development project**. It is built and improved by its maintainers and community, and its code, dependencies, tooling, and security model will continue to evolve.

We work hard to keep ACC **secure, privacy-conscious, reliable, and free of bugs**. We review changes, address reported issues, and continuously improve the project.

That said, ACC is open-source software developed in a rapidly evolving ecosystem, and **we cannot guarantee that it will always be free of bugs, security vulnerabilities, or unexpected behavior**.

Please use ACC responsibly and take appropriate precautions when working with sensitive data, private repositories, or untrusted projects.

If you discover a security issue, **please tell us as soon as possible**. Your report helps us investigate, fix the problem, and protect other users.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Use GitHub's private [Security Advisories](https://github.com/EnzoVezzaro/agents-code-context/security/advisories) to report vulnerabilities.

When possible, include:

* A description of the vulnerability
* Steps to reproduce it
* The affected version or commit
* Potential impact
* Proof of concept or relevant files
* Possible mitigations or suggested fixes

If you're unsure whether something is a security vulnerability, **please report it anyway**. We'd much rather take a look than have a real issue go unnoticed.

We will make a reasonable effort to acknowledge, investigate, and address valid security reports as quickly as possible.

## Security Considerations

ACC is primarily designed to operate on local repositories and is intended to avoid executing project code as part of its normal operation.

However, this should **not** be interpreted as a guarantee that ACC is safe to run against every repository or environment or agent.

Repositories may contain malicious or unexpected inputs, including:

* `AGENTS.md` and other instruction files
* Symlinks and unusual filesystem structures
* Extremely large files or repositories
* Malformed configuration
* Unexpected encodings or parser inputs
* Files specifically crafted to exploit ACC or its dependencies

Please use appropriate caution when running ACC against repositories you do not fully trust.

When working with sensitive information, private repositories, credentials, or production environments, **protect yourself and your data first**.

## Agentic Development

ACC is developed in the context of a rapidly evolving **agentic-development ecosystem**.

As coding agents increasingly read repositories, modify files, execute tools, and interact with development environments, new security and privacy risks are emerging.

We consider security an ongoing responsibility rather than a solved problem.

If you discover that ACC can:

* Execute unintended code
* Access files outside its intended scope
* Escape repository boundaries
* Cause unexpected network activity
* Bypass configured restrictions
* Expose sensitive information
* Or otherwise create a security risk

**please report it privately.**

Your report can help make ACC safer for the entire community.

## Disclaimer

ACC is provided as **open-source software on an "AS IS" and "AS AVAILABLE" basis**, to the fullest extent permitted by applicable law.

While we do our best to maintain a secure, privacy-conscious, reliable, and high-quality project, the maintainers and contributors cannot guarantee that ACC will always be free from bugs, vulnerabilities, security issues, privacy risks, or unexpected behavior.

Users are responsible for evaluating ACC and taking appropriate precautions for their own environment, data, repositories, and workflows.

To the fullest extent permitted by applicable law, the maintainers and contributors are not responsible for damages, losses, data loss, security incidents, unauthorized access, or other consequences arising from the use, misuse, modification, or inability to use ACC.

**Please protect yourself, protect your data, and use your best judgment when using any open-source software.**

## Disclosure

When appropriate, reported vulnerabilities may be disclosed publicly after a fix or mitigation is available.

For significant vulnerabilities, we may coordinate disclosure with the reporter.

Security researchers and contributors who responsibly report vulnerabilities may be credited in release notes, unless they prefer to remain anonymous.

## A Note on Security

ACC is community-driven open source.

That means security is something **we build together**.

We don't expect the project to be perfect. We expect people to inspect it, test it, challenge it, report problems, and help improve it.

**If you find something, please tell us. We'll do our best to fix it quickly.**

Thank you for helping make ACC safer for everyone.

## Recommended Practices

If you're using ACC, especially with AI coding agents, we recommend a few simple precautions:

* **Keep ACC and its dependencies up to date.** Security fixes are only useful once you install them.
* **Review agent changes before committing or deploying them.** Don't assume an agent is correct simply because the code compiles.
* **Be careful with untrusted repositories.** Treat repository instructions and agent context as potentially untrusted input.
* **Avoid exposing secrets.** Don't place API keys, passwords, tokens, private keys, or other sensitive credentials in files that ACC or an agent may read.
* **Use least privilege.** Give agents and development tools only the filesystem, credentials, and permissions they actually need.
* **Use isolated environments for sensitive work.** Containers, sandboxes, separate users, or dedicated development environments can reduce the impact of unexpected behavior.
* **Review your `.gitignore` and ACC configuration.** Make sure sensitive files and directories are excluded when appropriate.
* **Don't rely on ACC as a security boundary.** ACC provides context; it should not be treated as a replacement for operating-system permissions, sandboxing, authentication, or other security controls.
* **If something looks wrong, stop and investigate.** Don't continue an agent workflow simply because the tool appears to be behaving normally.
* **Report vulnerabilities responsibly.** Even a small observation can help us find a larger problem.

Most importantly:

> **You know your environment better than we do.**

Use ACC according to the level of trust appropriate for your repository and your data. When in doubt, **protect your data first and investigate before proceeding.**
