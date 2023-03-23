const core = require('@actions/core')
const github = require('@actions/github')
const AdmZip = require('adm-zip')
const {filesize} = require('filesize')
const moment = require('moment')
const pathname = require('path')
const fs = require("fs")
const lodash = require('lodash')

function getLatest(artifacts) {
  var latestArtifact = artifacts.reduce((prev, cur, index) => {
    var prevDate = new moment(prev.updated_at);
    var curDate = new moment(cur.updated_at);

    return curDate > prevDate && index ? cur : prev;
  });

  return latestArtifact
}

async function main() {
  try {
    // required
    const token = core.getInput("github_token", { required: true });
    const [owner, repo] = core.getInput("repo", { required: true }).split("/");
    const path = core.getInput("path", { required: true })

    // optional
    const artifactName = core.getInput("name", { required: false });
    const latest_input = (core.getInput("latest", { required: false }));
    const latest = latest_input ? latest_input.toLowerCase() === 'true' : false;

    const { Octokit } = require("@octokit/rest");
    const { paginateRest, composePaginateRest,} = require("@octokit/plugin-paginate-rest");
    const { createTokenAuth } = require("@octokit/auth-token");
    //const { throttling } = require("@octokit/plugin-throttling");
    //const { retry } = require("@octokit/plugin-retry");
    const { restEndpointMethods } = require("@octokit/plugin-rest-endpoint-methods");
    const auth = createTokenAuth(token);
    
    //const RestOctokit = Octokit.plugin(retry, throttling);
    const DownloadOctokit = Octokit.plugin(restEndpointMethods);
    
    const dlOcto = new DownloadOctokit({ auth: token });
/*
    const dlOcto = new DownloadOctokit({
      auth: token,
      authStrategy: auth,
      throttle: {
        onRateLimit: (retryAfter, options) => {
          octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)

          if (options.request.retryCount === 0) { // only retries once
            octokit.log.warn(`Retrying after ${retryAfter} seconds!`)
            return true
          }
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
          // does not retry, only logs a warning
          octokit.log.warn(`Secondary quota detected for request ${options.method} ${options.url}`);
        },
      },
    });
*/
    const PaginateOctokit = Octokit.plugin(paginateRest);
    const pageOcto = new PaginateOctokit({ auth: token });

    console.log('input', path, artifactName, latest);
    console.log("==> Repo:", owner + "/" + repo);

    const artifactsEndpoint = "GET /repos/:owner/:repo/actions/artifacts";
    const artifactsEndpointParams = {
      owner: owner,
      repo: repo,
      per_page: 100
    };

    let artifacts = [];

    for await (const artifactResponse of pageOcto.paginate
      .iterator(artifactsEndpoint, artifactsEndpointParams)) {
        artifacts = artifacts.concat(artifactResponse.data
        .filter(artifact => !artifact.expired)
        .filter(artifact => artifactName ? artifact.name === artifactName : true)
      );
    }
    
    if (latest && artifacts && artifacts.length) {
      console.log('Get latest artifact');

      var latestArtifact = getLatest(artifacts);
      
      if (latestArtifact) {
        console.log('Latest artifact', latestArtifact);
        artifacts = [ latestArtifact ];
      }
    }

    if (artifacts && artifacts.length) {
      artifacts = lodash(artifacts)
        .groupBy(artifact => artifact.name)
        .map(value => getLatest(value))
        .value();
    }

    console.log('Artifacts', artifacts);

    if (artifacts && artifacts.length) {
      for (let artifact of artifacts) {
        console.log("==> Artifact:", artifact.id);

        const size = filesize(artifact.size_in_bytes);

        console.log("==> Downloading:", artifact.name + ".zip", `(${size})`);

        const zip = await dlOcto.actions.downloadArtifact({
          owner: owner,
          repo: repo,
          artifact_id: artifact.id,
          archive_format: "zip",
        });

        console.log("Download complete.");
        const dir = artifactName ? path : pathname.join(path, artifact.name);

        fs.mkdirSync(dir, { recursive: true });

        const adm = new AdmZip(Buffer.from(zip.data));

        adm.getEntries().forEach((entry) => {
          const action = entry.isDirectory ? "creating" : "inflating";
          const filepath = pathname.join(dir, entry.entryName);

          console.log(`  ${action}: ${filepath}`)
        });

        adm.extractAllTo(dir, true);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

main()
