const express = require('express');
const router = express.Router();
const server = require('../lib/csdl_google_lib');
const { checkIfUserLoginRoute, sortStudentName } = require('../lib/function_lib');
const { getNameGlobal } = require('../lib/mogodb_lib');
const { ObjectId } = require('mongodb');
require('dotenv').config();
const name_global_databases = getNameGlobal();
// doan khoa route
function createDepRouter(client) {
    // quan li bo mon - doan khoa route
    router.get('/quanlibomon', checkIfUserLoginRoute, async (req, res) => {
        const user = req.session.user;

        // get all branch of department:
        const branchs = (
            await client
                .db(name_global_databases)
                .collection('branchs')
                .find(
                    {
                        dep: user.dep,
                    }, // find all data
                    {
                        projection: {
                            _id: 0,
                            name: 1,
                        },
                    },
                )
                .toArray()
        ).reverse();

        // get department name:
        const dep_name = await client
            .db(name_global_databases)
            .collection('deps')
            .findOne(
                {
                    _id: user.dep,
                }, // find all data
                {
                    projection: {
                        _id: 0,
                        name: 1,
                    },
                },
            );

        return res.render('doankhoa-manage-departments', {
            header: 'global-header',
            footer: 'global-footer',
            menu: 'doankhoa-menu',
            thongbao: 'global-notifications',
            dep: dep_name.name, // every branch have same department
            branchs: branchs,
        });
    });

    // quan li lop - doan khoa route
    router.get('/quanlilop', checkIfUserLoginRoute, async (req, res) => {
        const user = req.session.user;

        // get all branch of department:
        const branchs = await client
            .db(name_global_databases)
            .collection('branchs')
            .find(
                {
                    dep: user.dep,
                }, // find all data
                {
                    projection: {
                        name: 1,
                    },
                },
            )
            .toArray();

        let curr_load_branch;
        // get all classes of branchs:
        let classes = {}; // classes = {KTPM: [KTPM0121, KTPM0108, ...], CNTT: [CNTT0109, CNTT0209, ...], ...}
        let class_teachers = []; // class_teachers = [18102003, 19112003, ...]
        for (let i = 0; i < branchs.length; i++) {
            let dummy = await client
                .db(name_global_databases)
                .collection('classes')
                .find(
                    {
                        branch: branchs[i]._id,
                    }, // find all data
                    {
                        projection: {
                            cvht: 1,
                        },
                    },
                )
                .toArray();

            classes[branchs[i]._id] = dummy.map((cls) => cls._id);
            class_teachers.push(...dummy.map((cls) => cls.cvht));

            // set current load branch to i
            curr_load_branch = i + 1;
            // finish load one brach then check does number of classes over 30.
            if (class_teachers.length >= 30) {
                break;
            }
        }
        // get all teacher's name in current department
        const teachers = await client
            .db(name_global_databases)
            .collection('user_info')
            .find(
                {
                    'power.1': { $exists: true },
                    'power.4': { $exists: true },
                    $or: [
                        { branch: { $in: branchs.map((branch) => branch._id) } },
                        { branch: ObjectId.createFromHexString('650985a345e2e896b37efd4f') },
                    ],
                }, // user is teacher
                {
                    projection: {
                        first_name: 1,
                        last_name: 1,
                    },
                },
            )
            .toArray();

        // get all teacher's name of classes
        for (let i = 0; i < class_teachers.length; i++) {
            // replace current teacher's _id with teacher's name
            class_teachers[i] = await client
                .db(name_global_databases)
                .collection('user_info')
                .findOne(
                    {
                        _id: class_teachers[i],
                        'power.1': { $exists: true },
                        'power.4': { $exists: true },
                    }, // user is teacher
                    {
                        projection: {
                            first_name: 1,
                            last_name: 1,
                        },
                    },
                );
        }

        return res.render('doankhoa-manage-classes', {
            header: 'global-header',
            footer: 'global-footer',
            menu: 'doankhoa-menu',
            thongbao: 'global-notifications',
            dep_name: user.dep,
            branchs: branchs,
            classes: classes,
            teachers: teachers.map((teacher) => teacher.last_name + ' ' + teacher.first_name),
            teachers_id: teachers.map((teacher) => teacher._id),
            class_teachers: class_teachers,
            curr_load_branch: curr_load_branch,
        });
    });

    // danh sach bang diem khoa route
    router.get('/danhsachbangdiem', checkIfUserLoginRoute, async (req, res) => {
        try {
            const user = req.session.user;

            const school_year = await client
                .db(name_global_databases)
                .collection('school_year')
                .findOne({}, { projection: { _id: 0, year: 1 } });
            // check user login:
            if (user.pow[2]) {
                // get all branch of department:
                let branch_list = await client
                    .db(name_global_databases)
                    .collection('branchs')
                    .find({ dep: user.dep }, { projection: { _id: 1, name: 1 } })
                    .toArray();

                const classlist = await client
                    .db(name_global_databases)
                    .collection('classes')
                    .find(
                        { branch: { $in: branch_list.map((branch) => branch._id) } },
                        { projection: { _id: 1, branch: 1 } },
                    )
                    .toArray();

                const years = await client
                    .db(name_global_databases)
                    .collection('classes')
                    .findOne({ _id: classlist[0]._id }, { projection: { _id: 0, years: 1 } });
                // console.log(years);
                // get all student in staff member class:
                let student_list = await client
                    .db(name_global_databases)
                    .collection('user_info')
                    .find(
                        { class: classlist[0]._id, 'power.0': { $exists: true } },
                        {
                            projection: {
                                first_name: 1,
                                last_name: 1,
                                total_score: 1,
                            },
                        },
                    )
                    .toArray();

                student_list = sortStudentName(student_list);
                // console.log('curr', classlist[0]._id);
                // get all student total score from themself:
                let render = {
                    header: 'global-header',
                    footer: 'global-footer',
                    thongbao: 'global-notifications',
                    menu: 'doankhoa-menu',
                    staff_name: [],
                    student_list: student_list,
                    cls: classlist,
                    years: years.years,
                    curr_year: school_year.year,
                    curr_clss: classlist[0]._id,
                    branch: branch_list,
                };

                return res.render('doankhoa-grade-list', render);
            } else {
                // user not staff members
                // redirect to home
                return res.redirect('/');
            }
        } catch (e) {
            console.log('SYSTEM | DOAN_KHOA_DANH_SACH_BANG_DIEM | ERROR | ', e);
        }
    });

    //quan li co van - doan khoa route
    router.get('/quanlicv', checkIfUserLoginRoute, async (req, res) => {
        try {
            const user = req.session.user;

            // get all branch of department
            const all_branchs = await client
                .db(name_global_databases)
                .collection('branchs')
                .find(
                    {
                        dep: user.dep,
                    },
                    {
                        projection: {
                            name: 1,
                        },
                    },
                )
                .toArray();
            // get user name and class in dep
            const teachers = (
                await client
                    .db(name_global_databases)
                    .collection('user_info')
                    .find(
                        {
                            'power.1': { $exists: true },
                            'power.4': { $exists: true },
                            'power.999': { $exists: false },

                            $or: [
                                { branch: { $in: all_branchs.map((branch) => branch._id) } },
                                { branch: ObjectId.createFromHexString('650985a345e2e896b37efd4f') },
                            ],
                        }, // user is teacher
                        {
                            projection: {
                                first_name: 1,
                                last_name: 1,
                                class: 1,
                                branch: 1,
                            },
                        },
                    )
                    .toArray()
            ).reverse();
            console.log(teachers.length);

            let branch_list = [];
            for (let i = 0; i < teachers.length; i++) {
                const branch = await client
                    .db(name_global_databases)
                    .collection('branchs')
                    .findOne(
                        { _id: teachers[i].branch },
                        {
                            projection: {
                                _id: 0,
                                name: 1,
                            },
                        },
                    );
                branch_list.push(branch.name);
            }
            return res.render('doankhoa-manage-teacher', {
                header: 'global-header',
                footer: 'global-footer',
                thongbao: 'global-notifications',
                menu: 'doankhoa-menu',
                teachers: teachers,
                dataLength: teachers.length,
                branchs: branch_list,
                all_branchs: all_branchs,
            });
        } catch (err) {
            console.log('SYSTEM | DOAN_KHOA_QUAN_LY_CO_VAN_ROUTE | ERROR | ', err);
            return res.sendStatus(500);
        }
    });

    // Quan li hoat dong khoa route
    router.get('/quanlihoatdongkhoa', checkIfUserLoginRoute, async (req, res) => {
        const user = req.session.user;

        const school_year = await client
            .db(name_global_databases)
            .collection('school_year')
            .findOne({}, { projection: { _id: 0, year: 1 } });
        // check user login:
        if (user.pow[3] && user.pow[11]) {
            let branch_list = await client
                .db(name_global_databases)
                .collection('branchs')
                .find({ dep: user.dep }, { projection: { _id: 1, name: 1 } })
                .toArray();

            const classlist = await client
                .db(name_global_databases)
                .collection('classes')
                .find(
                    { branch: { $in: branch_list.map((branch) => branch._id) } },
                    { projection: { _id: 1, branch: 1 } },
                )
                .toArray();

            const years = await client
                .db(name_global_databases)
                .collection('classes')
                .findOne({ _id: classlist[0]._id }, { projection: { _id: 0, years: 1 } });

            // get all activities of school
            const school_atv = await client
                .db(name_global_databases)
                .collection('activities')
                .find(
                    {
                        year: school_year.year,
                    },
                    {
                        projection: {
                            name: 1,
                            content: 1,
                            year: 1,
                            start_time: 1,
                        },
                    },
                )
                .limit(10)
                .toArray();

            // get all activities of dep
            const dep_atv = await client
                .db(user.dep)
                .collection('activities')
                .find(
                    {
                        year: school_year.year,
                    },
                    {
                        projection: {
                            name: 1,
                            content: 1,
                            year: 1,
                            start_time: 1,
                        },
                    },
                )
                .limit(10)
                .toArray();

            // get all activities of class of department
            const collections = await client.db(user.dep).listCollections().toArray();

            // Filter collections ending with '_activities'
            const activityCollections = collections.filter((collection) => collection.name.endsWith('_activities'));

            // Loop through activity collections and retrieve all documents
            const cls_atvs = await activityCollections.map(async (collection) => {
                const dummy = await client
                    .db(user.dep)
                    .collection(collection.name)
                    .find(
                        {
                            year: school_year.year,
                        },
                        {
                            projection: {
                                name: 1,
                                content: 1,
                                cls: 1,
                                year: 1,
                                start_time: 1,
                            },
                        },
                    )
                    .limit(10)
                    .toArray();
                return dummy;
            });
            Promise.all(cls_atvs)
                .then((results) => {
                    // Khi tất cả các promise đã hoàn thành, results sẽ là một mảng chứa kết quả từ mỗi truy vấn.
                    // Bạn có thể làm gì đó với kết quả ở đây.
                    const cls_atv = [].concat(...results); // Kết hợp kết quả từ các truy vấn vào một mảng duy nhất
                    return res.render('doankhoa-manage-activities', {
                        header: 'global-header',
                        footer: 'global-footer',
                        thongbao: 'global-notifications',
                        menu: 'doankhoa-menu',
                        cls: classlist,
                        years: years.years,
                        curr_year: school_year.year,
                        branch: branch_list,
                        school_atv: school_atv,
                        dep_atv: dep_atv,
                        cls_atv: cls_atv,
                    });
                })
                .catch((error) => {
                    // Xử lý lỗi nếu có
                    console.log(error);
                });
        } else {
            return res.sendStatus(403);
        }
    });

    // danh sach sinh vien route
    router.get('/danhsachsinhvien', checkIfUserLoginRoute, async (req, res) => {
        const user = req.session.user;

        if (user.pow[4] || user.pow[7]) {
            // get all branch of department:
            const branchs = await client
                .db(name_global_databases)
                .collection('branchs')
                .find(
                    {
                        dep: user.dep,
                    }, // find all data
                    {
                        projection: {
                            _id: 1,
                        },
                    },
                )
                .toArray();

            // get all classes of department
            let classes = []; // class_teachers = [18102003, 19112003, (class_ids) ...]
            for (let i = 0; i < branchs.length; i++) {
                let dummy = await client
                    .db(name_global_databases)
                    .collection('classes')
                    .find(
                        {
                            branch: branchs[i]._id,
                        }, // find all data
                        {
                            projection: {
                                _id: 1,
                            },
                        },
                    )
                    .toArray();

                classes.push(...dummy.map((cls) => cls._id));
            }

            return res.render('doankhoa-student-list', {
                header: 'global-header',
                footer: 'global-footer',
                thongbao: 'global-notifications',
                menu: 'doankhoa-menu',
                classes: classes,
            });
        } else {
            return res.redirect('/');
        }
    });

    // doan khoa nhap diem route
    router.get('/nhapdiemdanhgia', checkIfUserLoginRoute, async (req, res) => {
        try {
            const user = req.session.user;
            const mssv = req.query.studentId;
            const cls = req.query.class;
            const schoolYearParam = req.query.schoolYear;
            const studentTotalScore = await client
                .db(user.dep)
                .collection(cls + '_std_table')
                .findOne(
                    {
                        mssv: mssv,
                        school_year: schoolYearParam,
                    },
                    {
                        projection: {
                            _id: 0,
                            first: 1,
                            second: 1,
                            third: 1,
                            fourth: 1,
                            fifth: 1,
                            total: 1,
                            img_ids: 1,
                        },
                    },
                );

            let stfTotalScore = await client
                .db(user.dep)
                .collection(cls + '_stf_table')
                .findOne(
                    {
                        mssv: mssv,
                        school_year: schoolYearParam,
                    },
                    {
                        projection: {
                            _id: 0,
                            first: 1,
                            second: 1,
                            third: 1,
                            fourth: 1,
                            fifth: 1,
                            total: 1,
                        },
                    },
                );

            let depTotalScore = await client
                .db(user.dep)
                .collection(cls + '_dep_table')
                .findOne(
                    {
                        mssv: mssv,
                        school_year: schoolYearParam,
                    },
                    {
                        projection: {
                            _id: 0,
                            first: 1,
                            second: 1,
                            third: 1,
                            fourth: 1,
                            fifth: 1,
                            total: 1,
                        },
                    },
                );
            nulltable = {
                fifth: [0, 0, 0, 0],
                first: [0, 0, 0, 0, 0],
                fourth: [0, 0, 0],
                second: [0, 0],
                third: [0, 0, 0],
                total: 0,
            };
            if (!stfTotalScore) {
                stfTotalScore = nulltable;
            }
            if (!depTotalScore) {
                depTotalScore = nulltable;
            }
            let link_img = [];

            if (studentTotalScore && studentTotalScore.img_ids) {
                for (const [key, value] of Object.entries(studentTotalScore.img_ids)) {
                    if (key == 'global') {
                        for (const i of value) {
                            link_img.push(await server.getDriveFileLinkAndDescription(i));
                        }
                    } else {
                        let activitie_info;
                        activitie_info = await client
                            .db(user.dep)
                            .collection(`${cls}_activities`)
                            .findOne(
                                {
                                    _id: key,
                                },
                                { projection: { name: 1 } },
                            );
                        if (!activitie_info) {
                            activitie_info = await client
                                .db(user.dep)
                                .collection('activities')
                                .findOne(
                                    {
                                        _id: key,
                                    },
                                    { projection: { name: 1 } },
                                );
                            if (!activitie_info) {
                                activitie_info = await client
                                    .db(name_global_databases)
                                    .collection('activities')
                                    .findOne(
                                        {
                                            _id: key,
                                        },
                                        { projection: { name: 1 } },
                                    );
                            }
                        }
                        for (const i of value) {
                            let imginfo = await server.getDriveFileLinkAndDescription(i);
                            if (imginfo) {
                                imginfo.fileDescription = activitie_info.name + '-' + imginfo.fileDescription;
                                link_img.push(imginfo);
                            }
                        }
                    }
                }
                return res.render('doankhoa-manage-grades', {
                    header: 'global-header',
                    thongbao: 'global-notifications',
                    footer: 'global-footer',
                    menu: 'doankhoa-menu',
                    img: link_img,

                    Scorestd: studentTotalScore,
                    Score: stfTotalScore,
                    Scorek: depTotalScore,
                });
            } else {
                return res.sendStatus(404);
            }
        } catch (err) {
            console.log('SYSTEM | DOAN_KHOA_NHAP_DIEM_ROUTE | ERROR | ', err);
            return res.status(500).json({ error: 'Lỗi hệ thống' });
        }
    });

    // doan khoa thoi han cham diem route
    router.get('/thoihan', checkIfUserLoginRoute, async (req, res) => {
        const curr_date = new Date();
        const school_year = await client
            .db(name_global_databases)
            .collection('school_year')
            .findOne(
                {},
                {
                    projection: { year: 1, start_day: 1, end_day: 1 },
                },
            );

        // set cbx text
        let cbx = 'Đang diễn ra';
        if (
            school_year.start_day <= curr_date &&
            (curr_date <= school_year.end_day || school_year.end_day.toISOString() == '2003-10-18T00:00:00.000Z')
        ) {
            cbx = 'Đang diễn ra';
        } else if (school_year.start_day > curr_date) {
            cbx = 'Sắp diễn ra';
        } else if (curr_date > school_year.end_day) {
            cbx = 'Đã kết thúc';
        }

        // check if end day is forever or not
        if (school_year.end_day.toISOString() == '2003-10-18T00:00:00.000Z') {
            school_year.end_day = undefined;
        }

        return res.render('doankhoa-time', {
            header: 'global-header',
            footer: 'global-footer',
            thongbao: 'global-notifications',
            menu: 'doankhoa-menu',

            school_year: school_year,
            cbx: cbx,
        });
    });

    // chi tiet hoat dong ------------------------------------------------------------------------------------------
    // school
    router.get('/quanlihoatdong/:level/:id', checkIfUserLoginRoute, async (req, res) => {
        const user = req.session.user;
        try {
            if (user.pow[3]) {
                // get id by req.params.id
                // identify current activity of school activities
                let curr_act;
                switch (req.params.level) {
                    case 'Truong':
                        curr_act = await client.db(name_global_databases).collection('activities').findOne({
                            _id: req.params.id,
                        });
                        break;
                    case 'Khoa':
                        curr_act = await client.db(user.dep).collection('activities').findOne({
                            _id: req.params.id,
                        });
                        break;
                    default:
                        curr_act = await client
                            .db(user.dep)
                            .collection(req.params.level + '_activities')
                            .findOne({
                                _id: req.params.id,
                            });
                        break;
                }
                // get all students information joined current activity
                let students_data = [];
                let bonus_true;
                let all_true = true; // check does all student is yes or not
                if (curr_act.student_list) {
                    for (const [key, value] of Object.entries(curr_act.student_list)) {
                        const data = await client
                            .db(name_global_databases)
                            .collection('user_info')
                            .findOne(
                                { _id: key },
                                {
                                    projection: {
                                        displayName: 1,
                                        class: 1,
                                    },
                                },
                            );
                        if (data) {
                            students_data.push(data);
                        } else {
                            students_data.push({ _id: 'none', displayName: 'none', class: ['none'] });
                        }

                        if (value == 1) {
                            // have one student not have bonus
                            bonus_true = false;
                        }

                        if (value == 0) {
                            // have one student not aproval yet
                            all_true = false;
                            bonus_true = false;
                        }
                    }
                }

                return res.render('doankhoa-activity-assessment', {
                    header: 'global-header',
                    thongbao: 'global-notifications',
                    footer: 'global-footer',
                    menu: 'doankhoa-menu',
                    curr_act: curr_act,
                    students_data: students_data,
                    all_true: all_true,
                    bonus_true: bonus_true,
                    idact: req.params.id,
                });
            } else {
                return res.redirect('/');
            }
        } catch (err) {
            console.log('SYSTEM | REVIEWS_ACTIVITY | ERROR | ', err);
            res.sendStatus(500);
        }
    });
    // -------------------------------------------------------------------------------------------

    return router;
}
module.exports = createDepRouter;
