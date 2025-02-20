const { Telegraf, Markup } = require('telegraf');
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bot = new Telegraf(process.env.API_KEY);

bot.start((ctx) => { // bot /start command
    ctx.reply(
        `👋 Привет, ${ctx.from.first_name}!\n\n` +
        `Я — лицейский бот, который ведет рейтинг учителей! \n\n` +
        `🔹 С моей помощью ты можешь:\n` +
        `✅ Узнать информацию об учителях — /teacher\n` +
        `✅ Оценить учителя — /rate\n` +
        `✅ Посмотреть глобальный рейтинг — /rating\n\n` +
        `🎓 Оценивай учителей честно и справедливо! И помни, что ты можешь оценить одного учителя только один раз! `,
        { parse_mode: "Markdown" }
    );
});

let teachers = JSON.parse(fs.readFileSync("teachers.json", "utf8"));

bot.command('rate', async (ctx) => {    
    ctx.reply('⭐ Выберите учителя для оценки:', teacherKeyboardWithPagination(1));
});

bot.action(/^page_(\d+)$/, async (ctx) => {
    ctx.answerCbQuery();
    
    const page = parseInt(ctx.match[1]);
    ctx.editMessageText('⭐ Выберите учителя для оценки:', {
        reply_markup: teacherKeyboardWithPagination(page).reply_markup,
        parse_mode: "Markdown"
    });
});

bot.command('teacher', async (ctx) => {    // get info about teacher - teacherKeyboardNames
    ctx.reply('📚 Выберите учителя для информации:', teacherKeyboardNames());
});

bot.command('rating', async (ctx) => {    // global rating of teachers - loadRatings
    const { teacherRatings, teacherNums } = loadRatings();
    const ratingList = teachers.map(teacher => {
        const id = teacher.id;
        const avgRating = teacherNums[id] > 0 ? (teacherRatings[id] / teacherNums[id]).toFixed(1) : "N/A";
        return `⭐ ${avgRating} — *${teacher.name}*`;
    }).join("\n");

    ctx.reply(`📊 *Глобальный рейтинг учителей:*\n\n${ratingList}`, { parse_mode: "Markdown" });
});

bot.command('top', async (ctx) => {
    const { teacherRatings, teacherNums } = loadRatings();

    const ratedTeachers = teachers
        .map(teacher => ({
            id: teacher.id,
            name: teacher.name,
            position: teacher.position,
            avgRating: teacherNums[teacher.id] > 0 ? (teacherRatings[teacher.id] / teacherNums[teacher.id]).toFixed(1) : null
        }))
        .filter(teacher => teacher.avgRating !== null) 
        .sort((a, b) => b.avgRating - a.avgRating) 
        .slice(0, 10); 

    if (ratedTeachers.length === 0) {
        return ctx.reply("❌ Пока никто не получил оценки.");
    }
    const topList = ratedTeachers
        .map((teacher, index) => `🏅 *${index + 1} место:* *${teacher.name}* (${teacher.position})\n⭐ _Средний рейтинг:_ ${teacher.avgRating}`)
        .join("\n\n");

    ctx.reply(`🏆 ТОП лучших учителей:\n\n${topList}`, { parse_mode: "Markdown" });
});

// functions below

const loadRatings = () => {
    const directoryPath = path.join(__dirname, "data");
    const teacherRatings = Object.fromEntries(teachers.map(({ id }) => [id, 0]));
    const teacherNums = Object.fromEntries(teachers.map(({ id }) => [id, 0]));

    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(directoryPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const records = JSON.parse(content);

        if (Array.isArray(records)) {
            for (const { teacherId, rating } of records) {
                if (teacherId && typeof rating === 'number') {
                    teacherRatings[teacherId] += rating;
                    teacherNums[teacherId]++;
                }
            }
        }
    }

    return { teacherRatings, teacherNums };
};

const teacherKeyboardNames = () => {
    return Markup.inlineKeyboard(
        teachers.map(teacher => [Markup.button.callback(teacher.name, `teacher_${teacher.id}_details`)])
    );
};

// const teacherKeyboardWithRatings = () => {
//     const { teacherRatings, teacherNums } = loadRatings();
    
//     return Markup.inlineKeyboard(
//         teachers.map(teacher => {
//             const id = teacher.id;
//             const avgRating = teacherNums[id] > 0 ? (teacherRatings[id] / teacherNums[id]).toFixed(1) : "0";
//             return [Markup.button.callback(`${teacher.name} (${avgRating}⭐)`, `teacher_${id}_rate`)];
//         })
//     );
// };

// callback functions below 

bot.action(/^teacher_(\d+)_rate$/, async (ctx) => {
    ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    const teacherId = parseInt(ctx.match[1]);
    const teacher = teachers.find(t => Number(t.id) === teacherId);

    if (!teacher) {
        return ctx.reply("❌ Ошибка! Учитель не найден.");
    }

    const userFilePath = path.join(__dirname, "data", `${userId}.json`);
    let userRatings = [];

    if (fs.existsSync(userFilePath)) {
        userRatings = JSON.parse(fs.readFileSync(userFilePath, "utf8"));
    }

    const alreadyRated = userRatings.some(r => r.teacherId === teacherId);

    if (alreadyRated) {
        return ctx.reply(`❗ Вы уже оценили *${teacher.name}*!`, { parse_mode: "Markdown" });
    }

    const { teacherRatings, teacherNums } = loadRatings();
    const avgRating = teacherNums[teacherId] > 0 ? (teacherRatings[teacherId] / teacherNums[teacherId]).toFixed(1) : "N/A";

    ctx.reply(
        `📖 Оцените учителя\n\n👤 ${teacher.name}\n`,
        Markup.inlineKeyboard([
            [Markup.button.callback("⭐ 1", `rate_${teacherId}_1`), Markup.button.callback("⭐ 2", `rate_${teacherId}_2`)],
            [Markup.button.callback("⭐ 3", `rate_${teacherId}_3`), Markup.button.callback("⭐ 4", `rate_${teacherId}_4`)],
            [Markup.button.callback("⭐ 5", `rate_${teacherId}_5`)]
        ]),
        { parse_mode: "Markdown" }
    );
});

bot.action(/^teacher_(\d+)_details$/, async (ctx) => {
    ctx.answerCbQuery();
    
    const teacherId = parseInt(ctx.match[1]);
    const teacher = teachers.find(t => Number(t.id) === teacherId);

    if (!teacher) {
        return ctx.reply("❌ Ошибка! Учитель не найден.");
    }

    const { teacherRatings, teacherNums } = loadRatings();
    const avgRating = teacherNums[teacherId] > 0 ? (teacherRatings[teacherId] / teacherNums[teacherId]).toFixed(1) : "N/A";

    ctx.reply(
        `📖 *Информация об учителе:*\n\n👤 ${teacher.name}\n📚 Предмет: ${teacher.position}\n⭐ Рейтинг: ${avgRating}\n📣 Оценок: ${teacherNums[teacherId] || 0}`,
        { parse_mode: "Markdown" }
    );
});


bot.action(/^rate_(\d+)_(\d+)$/, async (ctx) => {
    ctx.answerCbQuery();

    const userId = ctx.from.id;
    const teacherId = parseInt(ctx.match[1]);
    const rating = parseInt(ctx.match[2]);

    const teacher = teachers.find(t => Number(t.id) === teacherId);
    if (!teacher) {
        return ctx.reply("❌ Ошибка! Учитель не найден.");
    }

    const userFilePath = path.join(__dirname, "data", `${userId}.json`);

    let userRatings = [];
    if (fs.existsSync(userFilePath)) {
        userRatings = JSON.parse(fs.readFileSync(userFilePath, "utf8"));
    }

    const existingRatingIndex = userRatings.findIndex(r => r.teacherId === teacherId);
    if (existingRatingIndex !== -1) {
        return ctx.reply("❗ Вы уже оценили этого учителя! Оценка не может быть изменена.");
    }

    // Save the new rating
    userRatings.push({ teacherId, rating });
    fs.writeFileSync(userFilePath, JSON.stringify(userRatings, null, 2));

    ctx.reply(`✅ Вы поставили *${rating}⭐* учителю *${teacher.name}*! Спасибо за вашу оценку!`, { parse_mode: "Markdown" });
});







const teachersPerPage = 7; // Number of teachers per page

const teacherKeyboardWithPagination = (page = 1) => {
    const { teacherRatings, teacherNums } = loadRatings();
    
    const totalPages = Math.ceil(teachers.length / teachersPerPage);
    const startIndex = (page - 1) * teachersPerPage;
    const endIndex = startIndex + teachersPerPage;

    const pageTeachers = teachers.slice(startIndex, endIndex);

    const buttons = pageTeachers.map(teacher => {
        const id = teacher.id;
        const avgRating = teacherNums[id] > 0 ? (teacherRatings[id] / teacherNums[id]).toFixed(1) : "0";
        return [Markup.button.callback(`${teacher.name} (${avgRating}⭐)`, `teacher_${id}_rate`)];
    });

    // 📌 Add pagination buttons
    if (totalPages > 1) {
        const paginationButtons = [];
        if (page > 1) paginationButtons.push(Markup.button.callback("⏪ Prev", `page_${page - 1}`));
        if (page < totalPages) paginationButtons.push(Markup.button.callback("Next ⏩", `page_${page + 1}`));
        
        buttons.push(paginationButtons);
    }

    return Markup.inlineKeyboard(buttons);
};

bot.launch({ dropPendingUpdates: true });
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
