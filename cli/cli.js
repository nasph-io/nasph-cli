#!/usr/bin/env node

const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const shell = require("shelljs");
const clear = require("clear");
const { Docker } = require('node-docker-api');
const Docker2 = require('dockerode');
const { default: container } = require("node-docker-api/lib/container");
const path = require('path');

const fs = require('fs-extra');
const ejs= require('ejs');

const SwaggerParser = require("@apidevtools/swagger-parser");
const { paths } = require("jsonpath");

const { v4: uuidv4 } = require('uuid');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const dockerToList = new Docker2({ socketPath: '/var/run/docker.sock' });

const GENERATE_KRAKEND_FROM_SWAGGER_OPTION = "Generate Krakend config from Swagger/OAS";
const DOCKER_EVENTS_OPTION ="Containers Events"; 
const DOCKER_CONTAINERS_OPTION ="List Containers in this host"; 
const INIT_WORKSPACE_OPTION = "Initialize Workspace Config File"

const CREATE_KRAKEND_FILE_PLAIN_OPTION = "Create a standard KrakenD CE Config File "
const CREATE_KRAKEND_FILE_NASPH_OPTION = "Create a KrakenD Config File for Nasph API Manager "

 let krakendData = {
    configName: 'someConfigName',
    host: 'http://localhost',
    servers: [],
    basePath : '/api',
    billingURI: 'http://localhost',
    keyManagerURI: 'http://localhost',
    endpoints: [],
  }

  let endpoint = {
    uri: '/',
    method: 'GET',
    inputHeaders: [],
  }  

  let inputHeader = {
    name: '',
  }  

const init = () => {

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
        choices: [INIT_WORKSPACE_OPTION, GENERATE_KRAKEND_FROM_SWAGGER_OPTION,CREATE_KRAKEND_FILE_PLAIN_OPTION, CREATE_KRAKEND_FILE_NASPH_OPTION,  DOCKER_EVENTS_OPTION, DOCKER_CONTAINERS_OPTION],
    }];
    return inquirer.prompt(questions);
};

const run = async() => {
    // show script introduction
    init();

    // ask questions
    const answers = await askQuestions();
    const { command } = answers;

    var action = command;

    if (action == INIT_WORKSPACE_OPTION ) { 

        console.log(chalk.keyword("magenta")("nasph - Initialize/Update CLI workspace"));

        inquirer
        .prompt([
          {
            name: 'krakend_folder',
            message: 'Please, enter with the folder for generate krakend-config files'
          },
          {
            name: 'billing_host',
            message: 'You must inform the billing host and port (ex: https://myserver:9221):'
          },
          {
            name: 'keymanager_host',
            message: 'Please, inform the keycloak host and port (ex: https://localhost:8080):'
          },
        ])
        .then(answers => {

        const workspace_config = {
                krakend_folder: answers.krakend_folder,
                billing_host : answers.billing_host,
                keymanager_host : answers.keymanager_host,
              }  

          const currentPath = process.cwd();
    
          //check if local json with properties existies
          if (!fs.existsSync(currentPath + '/workspace.json')) {

            console.log(chalk.keyword("green")(`Creating workspace config file ${currentPath}/workspace.json`));
    
            fs.writeFileSync(currentPath + '/workspace.json', JSON.stringify(workspace_config, null, 4));
            process.exit(1);
          }

        })
    } 


    if (action == GENERATE_KRAKEND_FROM_SWAGGER_OPTION) {

        var currentPath = process.cwd();

      //check if local json with properties existies
      if (!fs.existsSync(currentPath + '/workspace.json')) {
    
        console.log(chalk.keyword("red")("Please, execute the first step and create the workpace config file"));
        process.exit(1);


      }

        console.log(chalk.keyword("magenta")("nasph - Let's convert Swagger/OAS to KrakenD config"));

        inquirer
        .prompt([
            {
                name: 'oaspath',
                message: 'Please, inform here where you swagger or oas file is located?'
              },
              {
                name: 'host',
                message: 'Please, set the HOST for the endpoint/backend (ex: http://myapiserver:2210)',
                default: "http://myapiserver:2210"
              },
              {
                name: 'basePath',
                message: 'Inform the existing base path for reaching the backends (ex: /v1/myapis/)',
                default: "/v1/services"
              }             

        ])
        .then(answers => {
          const file_path = answers.oaspath;
          const output = answers.output;
          const host = answers.host;
          const basePath = answers.basePath;

          const options = {};
          var currentPath = process.cwd();

          console.log(chalk.keyword("green")(`File: ${file_path}`));

         // myAPI = '/Users/edgar/Downloads/openinsurance/hdi-offers.yml';
         myAPI = '/Users/edgar/Downloads/openinsurance/discovery.yml';

          SwaggerParser.validate(myAPI, (err, api) => {
            if (err) {
              console.error(err);
            }
            else {
              console.log(chalk.keyword("cyan")(`API Name: ${api.info.title} - version: ${api.info.version} ` ));

              krakendData.configName = `Config for ${api.info.title} - version ${api.info.version} `;
              
              
              krakendData.host = host;

              krakendData.basePath = basePath;

              let paths = Object.keys(api.paths || {});

              //https://github.com/APIDevTools/swagger-parser/blob/main/lib/validators/spec.js

              //console.info(paths);
            
              for (let pathName of paths) {

                  let path = api.paths[pathName];

                  let pathId = pathName;
                  
                  //console.log(`Path URI: ${pathId}`);

                  endpoint.uri=pathId;

                  const httpMethod = Object.keys(path);

                  //console.log("HTTP Method:", httpMethod );

                  endpoint.method = httpMethod[0];
                  
                  //console.info(path[httpMethod].parameters) ;

                  for (let param of path[httpMethod].parameters) {

                        if (param.in=='header') {
                            endpoint.inputHeaders.push(param.name);
                        }

                  }

                  krakendData.endpoints.push(endpoint);

              }

              //console.info(JSON.stringify (krakendData));

              const filename = path.join(__dirname, './templates/krakend-plain.ejs');

              const options = {};

              const data = {
                krakendData
              };

              ejs.renderFile(filename, data, options, function (err, str) {
                // str => Rendered HTML string
                if (err) {
                  console.error(chalk.magenta("Error parsing the informed template: " + err));
                }

              //console.info(str);

              const config = require(process.cwd()+'/workspace.json');

              const outputFile = path.join(config.krakend_folder+"/krakend.json" );
              fs.ensureFileSync(outputFile);
              fs.outputFileSync(outputFile, str);

              console.log(chalk.magenta(`Generated Krakend Config file saved in:${outputFile}`));

            });
            }
          });

                 
         

        })


    }

    if (action == DOCKER_CONTAINERS_OPTION) {

        console.log(chalk.keyword("magenta")("================================================================================"));
        console.log(chalk.keyword("magenta")("nasph - listing the all docker containers in execution at this moment"))
            // List
        await dockerToList.listContainers({ all: true }, (err, containers) => {
             if (containers.length > 0){
                console.log('Total number of containers: ' + containers.length);

                containers.forEach(function (container) {
                let state = container.Status;
                        if(state.substr(0, 2) == "Up"){
                            console.log(chalk.keyword("green")(`Container: ${container.Names} - current status ${container.Status} - based on the image ${container.Image}`));
                        }else{
                            console.log(chalk.keyword("red")(`Container: ${container.Names} - current status ${container.Status} - based on the image ${container.Image}`));
                        }
                  })
                console.log(chalk.keyword("magenta")("================================================================================"));
                }
             else{
                console.log("No containers in execution at this moment.");
                console.log(chalk.keyword("magenta")("================================================================================"));
             }
        });

      console.log(chalk.keyword("magenta")("================================================================================"));
    };

    if (action == DOCKER_EVENTS_OPTION) {
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