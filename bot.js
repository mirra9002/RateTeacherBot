const { Telegraf, Markup } = require('telegraf');
require("dotenv").config();
const fs = require("fs");

const bot = new Telegraf(process.env.API_KEY);
bot.start((ctx) => ctx.reply('Welcome'));

let teachers = JSON.parse(fs.readFileSync("teachers.json", "utf8"));

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

bot.command('rate', async (ctx) => {    
    ctx.reply('Выберите учителя:', teacherKeyboard());
});

const teacherKeyboard = () => {
    return Markup.inlineKeyboard(teachers.map(teacher => [Markup.button.callback(teacher.name, `teacher_${teacher.id}`)]));
}

bot.action(/^teacher_\d+$/, (ctx) => {
    ctx.answerCbQuery();
    const chosenTeacherId = ctx.match[0].split('_')[1]; 
    const chosenTeacher = teachers.find(t => t.id === chosenTeacherId);
    
    if (chosenTeacher.usersRated.includes(ctx.from.id)) {
        return ctx.reply("Вы уже оценивали этого учителя!");
    };

    ctx.reply(`Вы выбрали ${chosenTeacher.name}! Оцените этого учителя`);
    ctx.reply('Оценка:', Markup.inlineKeyboard([
        [Markup.button.callback('⭐ 1', `rate_${chosenTeacher.id}_1`)],
        [Markup.button.callback('⭐ 2', `rate_${chosenTeacher.id}_2`)],
        [Markup.button.callback('⭐ 3', `rate_${chosenTeacher.id}_3`)],
        [Markup.button.callback('⭐ 4', `rate_${chosenTeacher.id}_4`)],
        [Markup.button.callback('⭐ 5', `rate_${chosenTeacher.id}_5`)],
    ]),  { parse_mode: "Markdown" });
});

bot.action(/^rate_\d+_\d+$/, (ctx) => {
    ctx.answerCbQuery();
    const parts = ctx.match[0].split("_"); 
    const teacher = teachers.find(t => Number(t.id) === parseInt(parts[1])); // teacher
    const rating = parseInt(parts[2]); // rating
    if (!teacher) {
        return ctx.reply("Ошибка! Учитель не найден. Возможно, бот был перезапущен.");
    }
    if (teacher.usersRated.includes(ctx.from.id)) {
        return ctx.reply("Вы уже оценивали этого учителя!");
    };
    teacher.ratings.push(rating);
    teacher.rating = teacher.ratings.reduce((a,b) => a+b, 0) / teacher.ratings.length;
    
    teacher.usersRated.push(ctx.from.id);
    fs.writeFileSync("teachers.json", JSON.stringify(teachers, null, 2));
    fs.writeFileSync("teachers.json", JSON.stringify(teachers, null, 2));
    ctx.reply(`Спасибо, вы поставили ${rating} ⭐ учителю ${teacher.name}! \nТеперь рейтинг этого учителя: ${teacher.rating.toFixed(1)}`)
})

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

bot.command('rating', async (ctx) => {    
    const resTeachers = teachers.map(teacher => `${teacher.name} - ${teacher.rating ? teacher.rating.toFixed(1) : "0.0"} ⭐ (всего ${teacher.ratings.length} оценок)`).join('\n');
    ctx.reply(`📊 *Глобальный рейтинг*: \n\n${resTeachers}`, { parse_mode: "Markdown" });
    
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

const teacherKeyboardInfo = () => {
    return Markup.inlineKeyboard(teachers.map(teacher => [Markup.button.callback(teacher.name, `teacher_${teacher.id}_info`)]));
}

bot.command('teacher', async (ctx) => {    
    ctx.reply('Выберите учителя,:', teacherKeyboardInfo());
});
bot.action(/^teacher_(\d+)_info$/, (ctx) => {
    ctx.answerCbQuery();
    const parts = ctx.match[0].split("_"); 
    const teacher = teachers.find(t => Number(t.id) === parseInt(parts[1])); // teacher
    ctx.reply(`📖 Информация об учителе:\n\n*${teacher.name}*\n📚 Предмет: ${teacher.position}\n⭐ Рейтинг: ${teacher.rating.toFixed(1)}\n📣 Оценки: ${teacher.ratings.length}`, 
    { parse_mode: "Markdown" });
})


bot.launch({ dropPendingUpdates: true });
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));