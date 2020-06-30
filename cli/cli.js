#!/usr/bin/env node

const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const shell = require("shelljs");
const clear = require("clear");
const { Docker } = require('node-docker-api');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const init = () => {



    clear();

    clear();
    console.log(
        chalk.green(
            figlet.textSync("nasph-cli", {
                font: "Standard",
                horizontalLayout: "default",
                verticalLayout: "default"
            })
        )
    );
};

const askQuestions = () => {
    const questions = [{
        type: "list",
        name: "command",
        message: "What would you like to do?",
        choices: ["install portainer", "generate architecture diagram", "container-events", "list-containers"],
    }];
    return inquirer.prompt(questions);
};

const run = async() => {
    // show script introduction
    init();

    // ask questions
    const answers = await askQuestions();
    const { command } = answers;

    console.log("Action selected:  " + command);

    var action = command;

    if (action == 'list-containers') {

        console.log(chalk.keyword("magenta")("================================================================================"));
        console.log(chalk.keyword("magenta")("nasph - listing the all docker containers in execution at this moment"))
            // List
        docker.container.list()
            // Inspect
            .then(containers => containers[0].status())
            .then(container => container.top())
            .then(processes => console.log(processes))
            .catch(error => console.log(error));

        console.log(chalk.keyword("magenta")("================================================================================"));


    }

    if (action == 'container-events') {
        console.log(chalk.keyword("magenta")("================================================================================"));

        console.log(chalk.keyword("magenta")("nasph- listing the all container events"))
        const promisifyStream = stream => new Promise((resolve, reject) => {
            stream.on('data', data => console.log(data.toString()))
            stream.on('end', resolve)
            stream.on('error', reject)
        })

        const docker = new Docker({ socketPath: '/var/run/docker.sock' })

        docker.events({
                since: ((new Date().getTime() / 1000) - 60).toFixed(0)
            })
            .then(stream => promisifyStream(stream))
            .catch(error => console.log(error))
        console.log(chalk.keyword("magenta")("================================================================================"));

    }


    if (action == 'diagram') {
        console.log(chalk.keyword("magenta")("nasph- generating the nasph architecture ...."))

        exec("docker run --rm --name dcv -v $(pwd):/input pmsipilot/docker-compose-viz render -m image docker-compose.yml --force", (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(chalk.keyword("magenta")("The architecture diagram was generated on docker-compose.png here on this folder"));

        });

    };
}
run();

// installing command line: npm install -g