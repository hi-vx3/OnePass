const nodemailer = require('nodemailer');

// قم بإنشاء transporter باستخدام إعدادات Gmail
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", // خادم SMTP الخاص بـ Gmail
    port: 587, // المنفذ الموصى به (TLS)
    secure: false, // `true` للمنفذ 465, `false` للمنافذ الأخرى
    auth: {
        user: 'najid.xdev@gmail.com', // بريدك الإلكتروني في Gmail
        pass: 'majh twhj khfz kibl'   // كلمة مرور التطبيقات المكونة من 16 حرفًا
    },
    // زيادة مهلة الاتصال إذا لزم الأمر
    connectionTimeout: 10000, // 10 ثواني (بالمللي ثانية)
    socketTimeout: 10000, // 10 ثواني
});

// مثال على كيفية استخدام الـ transporter لإرسال البريد
async function sendTotpEmail(recipientEmail, username, totpCode) {
    try {
        // اقرأ قالب HTML (الكود يفترض أنك تقرأ الملف)
        // let htmlTemplate = fs.readFileSync('path/to/email-totp.html', 'utf8');
        // const htmlToSend = htmlTemplate.replace('{{username}}', username).replace('{{totp_code}}', totpCode);

        const mailOptions = {
            from: '"OnePass" <your.email@gmail.com>', // اسم المرسل وبريدك
            to: recipientEmail,
            subject: `رمز التحقق الخاص بك هو ${totpCode}`,
            // text: `رمز التحقق الخاص بك هو: ${totpCode}`, // نسخة نصية بسيطة
            html: `<h1>رمزك هو: ${totpCode}</h1>` // هنا تضع محتوى قالب HTML بعد تعبئة البيانات
        };

        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return true;

    } catch (error) {
        console.error('Error sending email:', error);
        // هذا الخطأ سيشبه الخطأ الذي واجهته إذا فشل الاتصال
        // { code: 'ESOCKET', command: 'CONN' }
        return false;
    }
}

// استدعاء الدالة
 sendTotpEmail('test@example.com', 'أحمد', '123456');
