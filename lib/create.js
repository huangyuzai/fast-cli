// lib/create.js
const path = require('path')
const ora = require('ora')
const fs = require('fs-extra')
const inquirer = require('inquirer')
const Generator = require('./Generator')

module.exports = async function (name, options) {
    // 执行创建命令

    // 当前命令行选择的目录
    const cwd = process.cwd();
    // 需要创建的目录地址
    const targetAir = path.join(cwd, name)
    // 目录是否已经存在？
    if (fs.existsSync(targetAir)) {

        // 是否为强制创建？
        if (options.force) {
            await fs.remove(targetAir)
        } else {

            // 询问用户是否确定要覆盖
            let {action} = await inquirer.prompt([
                {
                    name: 'action',
                    type: 'list',
                    message: 'Target directory already exists Pick an action:',
                    choices: [
                        {
                            name: 'Overwrite',
                            value: 'overwrite'
                        }, {
                            name: 'Cancel',
                            value: false
                        }
                    ]
                }
            ])

            if (!action) {

            } else if (action === 'overwrite') {
                // 使用 ora 初始化，传入提示信息 message
                const spinner = ora('waiting to delete folder');
                // 开始加载动画
                spinner.start();
                try {
                    // 移除已存在的目录
                    await fs.remove(targetAir)
                    // 状态为修改为成功
                    spinner.succeed('delete successful');
                } catch (e) {
                    // 状态为修改为失败
                    spinner.fail('delete failed ...')
                }
            }
        }
    }
    // 创建项目
    const generator = new Generator(name, targetAir, options);

    // 开始创建项目
    generator.create()
}
