import path from "path";
import { promises as fs } from "fs";

import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import * as artifact from "@actions/artifact";
import * as glob from "@actions/glob";

import { markdownTable } from "markdown-table";

import Term from "./Term";
import SizeLimit from "./SizeLimit";
import download from "github-fetch-workflow-artifact";

const SIZE_LIMIT_HEADING = `## size-limit report 📦 `;
const ARTIFACT_NAME = "size-limit-action";
const RESULTS_FILE = "size-limit-results.json";

async function fetchPreviousComment(
  octokit: ReturnType<typeof getOctokit>,
  repo: { owner: string; repo: string },
  pr: { number: number }
) {
  const { data: commentList } = await octokit.rest.issues.listComments({
    ...repo,
    // eslint-disable-next-line camelcase
    issue_number: pr.number,
  });

  const sizeLimitComment = commentList.find((comment) =>
    comment.body.startsWith(SIZE_LIMIT_HEADING)
  );
  return !sizeLimitComment ? null : sizeLimitComment;
}

async function run() {
  const { getInput, setFailed } = core;

  try {
    const { payload, repo } = context;
    const pr = payload.pull_request;
    const mainBranch = getInput("main_branch");
    const runForBranchInput = getInput("run_for_branch");

    const runForBranch =
      runForBranchInput === "true"
        ? true
        : runForBranchInput === "false"
        ? false
        : context.ref.includes(mainBranch);

    if (!runForBranch && !pr) {
      throw new Error(
        "No PR found. Only pull_request workflows are supported."
      );
    }

    const skipStep = getInput("skip_step");
    const buildScript = getInput("build_script");
    const cleanScript = getInput("clean_script");
    const directory = getInput("directory") || process.cwd();
    const windowsVerbatimArguments =
      getInput("windows_verbatim_arguments") === "true" ? true : false;
    const githubToken = getInput("github_token");
    const threshold = getInput("threshold");

    const octokit = getOctokit(githubToken);
    const term = new Term();
    const limit = new SizeLimit();
    const artifactClient = artifact.create();
    const resultsFilePath = path.resolve(__dirname, RESULTS_FILE);

    if (runForBranch) {
      let base;
      const { output: baseOutput } = await term.execSizeLimit(
        skipStep,
        buildScript,
        cleanScript,
        windowsVerbatimArguments,
        directory
      );

      try {
        base = limit.parseResults(baseOutput);
      } catch (error) {
        core.error(
          "Error parsing size-limit output. The output should be a json."
        );
        throw error;
      }

      try {
        await fs.writeFile(resultsFilePath, JSON.stringify(base), "utf8");
      } catch (err) {
        core.error(err);
      }
      const globber = await glob.create(resultsFilePath, {
        followSymbolicLinks: false,
      });
      const files = await globber.glob();

      await artifactClient.uploadArtifact(ARTIFACT_NAME, files, __dirname);

      return;
    }

    let base;
    let current;

    try {
      // Ignore failures here as it is likely that this only happens when introducing size-limit
      // and this has not been run on the main branch yet
      await download(octokit, {
        ...repo,
        artifactName: ARTIFACT_NAME,
        branch: mainBranch,
        downloadPath: __dirname,
        workflowEvent: "push",
        workflowName: `${process.env.GITHUB_WORKFLOW || ""}`,
      });
      base = JSON.parse(
        await fs.readFile(resultsFilePath, { encoding: "utf8" })
      );
    } catch (error) {
      core.startGroup("Warning, unable to find base results");
      core.debug(error);
      core.endGroup();
    }

    const { status, output } = await term.execSizeLimit(
      skipStep,
      buildScript,
      cleanScript,
      windowsVerbatimArguments
    );
    try {
      current = limit.parseResults(output);
    } catch (error) {
      core.error(
        "Error parsing size-limit output. The output should be a json."
      );
      throw error;
    }

    const thresholdNumber = Number(threshold);

    // @ts-ignore
    const sizeLimitComment = await fetchPreviousComment(octokit, repo, pr);

    const shouldComment =
      isNaN(thresholdNumber) ||
      limit.hasSizeChanges(base, current, thresholdNumber) ||
      sizeLimitComment;

    if (shouldComment) {
      const body = [
        SIZE_LIMIT_HEADING,
        markdownTable(limit.formatResults(base, current)),
      ].join("\r\n");

      try {
        if (!sizeLimitComment) {
          await octokit.rest.issues.createComment({
            ...repo,
            // eslint-disable-next-line camelcase
            issue_number: pr.number,
            body,
          });
        } else {
          await octokit.rest.issues.updateComment({
            ...repo,
            // eslint-disable-next-line camelcase
            comment_id: sizeLimitComment.id,
            body,
          });
        }
      } catch (error) {
        core.error(
          "Error updating comment. This can happen for PR's originating from a fork without write permissions."
        );
      }
    }

    if (status > 0) {
      setFailed("Size limit has been exceeded.");
    }
  } catch (error) {
    core.error(error);
    setFailed(error.message);
  }
}

run();
