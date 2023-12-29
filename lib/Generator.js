// lib/Generator.js
const { getRepoList, getTagList } = require('./http')
const ora = require('ora')
const inquirer = require('inquirer')
const path = require('path')
const chalk = require('chalk')
const util = require('util')
const downloadGitRepo = require('download-git-repo')
const fs = require('fs-extra')

/* 默认本地模版只有 */
let templateOptions = ['vben']

// 添加加载动画
async function wrapLoading (fn, message, ...args) {
    // 使用 ora 初始化，传入提示信息 message
    const spinner = ora(message);
    // 开始加载动画
    spinner.start();

    try {
        // 执行传入方法 fn
        const result = await fn(...args);
        // 状态为修改为成功
        spinner.succeed();
        return result;
    } catch (error) {
        // 状态为修改为失败
        spinner.fail('Request failed, refetch ...')
    }
}

class Generator {
    constructor (name, targetDir, options){
        // 目录名称
        this.name = name;
        // 创建位置
        this.targetDir = targetDir;
        // 对 download-git-repo 进行 promise 化改造
        this.downloadGitRepo = util.promisify(downloadGitRepo);
        // 用户选择的选项
        this.options = options
        // 获取的文件，用于复制文件时判断是否已复制
        this.renameFiles = {
            _gitignore: '.gitignore',
        }
    }

    // 获取用户选择的模板
    // 1）从远程拉取模板数据
    // 2）用户选择自己新下载的模板名称
    // 3）return 用户选择的名称

    async getRepo() {
        // 1）从远程拉取模板数据
        const repoList = await wrapLoading(getRepoList, 'waiting fetch template');
        // const repoList = []
        if (!repoList) return;

        // 过滤我们需要的模板名称
        templateOptions = repoList.map(item => item.name);

        // 2）用户选择自己新下载的模板名称
        const { repo } = await inquirer.prompt({
            name: 'repo',
            type: 'list',
            choices: templateOptions,
            message: 'Please choose a template to create project'
        })

        // 3）return 用户选择的名称
        return repo;
    }

    // 获取用户选择的版本
    // 1）基于 repo 结果，远程拉取对应的 tag 列表
    // 2）用户选择自己需要下载的 tag
    // 3）return 用户选择的 tag

    async getTag(repo) {
        // 1）基于 repo 结果，远程拉取对应的 tag 列表
        const tags = await wrapLoading(getTagList, 'waiting fetch tag', repo);
        if (!tags) return;

        // 过滤我们需要的 tag 名称
        const tagsList = tags.map(item => item.name);

        // 2）用户选择自己需要下载的 tag
        const { tag } = await inquirer.prompt({
            name: 'tag',
            type: 'list',
            choices: tagsList,
            message: 'Place choose a tag to create project'
        })

        // 3）return 用户选择的 tag
        return tag
    }

    // 下载远程模板
    // 1）拼接下载地址
    // 2）调用下载方法
    async download(repo, tag){

        // 1）拼接下载地址
        const requestUrl = `zhurong-cli/${repo}${tag?'#'+tag:''}`;

        // 2）调用下载方法
        await wrapLoading(
            this.downloadGitRepo, // 远程下载方法
            'waiting download template', // 加载提示信息
            requestUrl, // 参数1: 下载地址
            path.resolve(process.cwd(), this.targetDir)) // 参数2: 创建位置
    }


    /*从模版获取文件=====================S*/

    // 复制文件/文件夹
    copy(src, dest) {
        const stat = fs.statSync(src)
        if (stat.isDirectory()) {
            this.copyDir(src, dest)
        } else {
            fs.copyFileSync(src, dest)
        }
    }

    copyDir(srcDir, destDir) {
        fs.mkdirSync(destDir, { recursive: true })
        for (const file of fs.readdirSync(srcDir)) {
            const srcFile = path.resolve(srcDir, file)
            const destFile = path.resolve(destDir, file)
            this.copy(srcFile, destFile)
        }
    }


    // 写入文件
    write (file, templateDir) {
        const targetPath = path.join(this.targetDir, this.renameFiles[file] ?? file)
        // 复制文件/文件夹
        this.copy(path.join(templateDir, file), targetPath)
    }

    // 获取本地模版
    async getLocalTemplate () {
        // 2）用户选择自己本地的模板名称
        const { repo } = await inquirer.prompt({
            name: 'repo',
            type: 'list',
            choices: templateOptions,
            message: 'Please choose a template to create project'
        })

        // 3）return 用户选择的名称
        return repo;
    }

    // 根据选择的模版名称，读取下面的文件
    async getFileSync (repo) {
        const templateDir = path.join(process.cwd(), `template-${repo}`)
        const files = fs.readdirSync(templateDir)
        // 如果不存在该目录则先创建
        if (!fs.existsSync(this.targetDir)) {
            fs.mkdirSync(this.targetDir, { recursive: true })
        }
        // 使用 ora 初始化，传入提示信息 message
        const spinner = ora('copy files ...');
        // 开始加载动画
        spinner.start();
        // 循环文件列表，复制到指定目录
        for (const file of files) {
            this.write(file, templateDir)
        }
        // 状态为修改为成功
        spinner.succeed('copy files successful')
    }
    /*从模版获取文件=====================E*/

    /**
    * 核心创建逻辑
     * 可以通过传入的参数 -t or --template 判断用户是需要从template拉取还是从线上仓库拉取
     *
     * 方式一：从模版拉取
     *   1）判断是否存在该目录，不存在则先创建
     *   2）获取到指定目录下的所有文件，包括文件夹
     *   3）递归拷贝所有文件
     *
     * 方式二：从线上仓库拉取
     *   1）获取模板名称
     *   2）获取 tag 名称
     *   3）下载模板到模板目录
    * */
    async create(){
        // 判断是否选择从模版获取，否则就从线上仓库拉取
        if (this.options?.template) {
            // 获取自定义的模版列表
            const repo = await this.getLocalTemplate()
            // 获取指定目录的文件
            this.getFileSync(repo)
        } else {
            // 1）获取模板名称
            const repo = await this.getRepo()

            // 2) 获取 tag 名称
            const tag = await this.getTag(repo)

            // 3）下载模板到模板目录
            await this.download(repo, tag)
        }

        // 4）模板使用提示
        console.log(`\r\nSuccessfully created project ${chalk.cyan(this.name)}`)
        console.log(`\r\n  cd ${chalk.cyan(this.name)}`)
        console.log('  npm install')
        console.log('  npm run dev\r\n')
    }
}

module.exports = Generator;
