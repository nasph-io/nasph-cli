#!/usr/bin/env node

"use strict";
const chalk = require("chalk");
const clear = require("clear");
const figlet = require("figlet");
const { exec } = require("child_process");
const fs = require('fs')

const args = require("yargs").argv;
const { Docker } = require('node-docker-api');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

clear();

console.log(
    chalk.magentaBright(
        figlet.textSync('Nasph', { horizontalLayout: 'full' })
    )
);
console.log(chalk.black.bgMagentaBright.bold("nasph cli - building easier api architectures "));

var argv = require("yargs")
    .usage('Usage: $0 <command> [options]')
    .command('login', 'Authenticate user', (yargs) => {
            // login command options
            return yargs.option('username')
                .option('password')
        },
        ({ username, password }) => {
            // super secure login, don't try this at home
            if (username === 'admin' && password === 'password') {
                console.log('Successfully loggedin')
                fs.writeFileSync('~/.credentials', JSON.stringify({ isLoggedIn: true, token: 'very-very-very-secret' }))
            } else {
                console.log('Please provide a valid username and password')
            }
        }
    ).argv

console.log("action selected :", argv.action);

if (args.action == 'containers') {
    console.log(chalk.keyword("magenta")("nasph- listing containers in execution"))
        // List
    docker.container.list()
        // Inspect
        .then(containers => containers[0].status())
        .then(container => container.top())
        .then(processes => console.log(processes))
        .catch(error => console.log(error));

}

if (args.action == 'events') {
    console.log(chalk.keyword("magenta")("nasph- container events"))
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

}


if (args.action == 'diagram') {
    console.log(chalk.keyword("magenta")("nasph- generating the nasph architecture"))

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

}

//console.log(chalk.keyword("magenta")("nasph- All tasks executed with sucessful!"));

// installing command line: npm install -g