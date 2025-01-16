import inquirer from "inquirer";
// import { QueryResult } from 'pg';
import { pool, connectToDb } from './connection.js';

async function viewAllDepartments(): Promise<void> {
    // console.log("entering viewAllDepartments")
    const result = await pool.query(
        `SELECT name 
         FROM departments`);

    
            // console.log("got result");
            // console.log(result.fields)
    console.table(result.rows);
        //   console.log("logged result")
           
    //   console.log("leaving viewAllDepartments")

}

async function viewAllRoles(): Promise<void> {
    const result = await pool.query(
        `SELECT 
             departments.name AS department, 
             title, 
             salary
         FROM 
             roles JOIN departments 
             ON department_id = departments.id 
         ORDER BY departments.name`);    
    console.table(result.rows);
}

async function viewAllEmployees(): Promise<void> {
    const result = await pool.query(
        `SELECT
            employees.first_name,
            employees.last_name,
            roles.title AS title,
            departments.name AS department,
            managers.first_name || ' ' || managers.last_name AS manager
        FROM
            employees JOIN roles
            ON role_id = roles.id 
            JOIN departments
            ON department_id = departments.id
            LEFT JOIN employees AS managers
            ON employees.manager_id = managers.id
         
        ORDER BY employees.last_name, employees.first_name`);
    console.table(result.rows);
}

async function viewEmployeesByDepartment(): Promise<void> {
    const departments = await pool.query(
        'SELECT id,name from departments');
      if (departments.rowCount == 0) {
        throw "Must add department(s) first"
      }
    const answer = await inquirer.prompt([
        {
            name: "department",
            message: "Department",
            type: "list",
            choices: departments.rows.map(element => element.name)
        }    
    ]);
    const departmentId = 
    departments.rows.find(
      element => element.name == answer.department
     ).id;
    const result = await pool.query(
        `SELECT
            employees.first_name,
            employees.last_name,
            roles.title AS title,
            departments.name AS department,
            managers.first_name || ' ' || managers.last_name AS manager
        FROM
            employees JOIN roles
            ON role_id = roles.id 
            JOIN departments
            ON department_id = departments.id
            LEFT JOIN employees AS managers
            ON employees.manager_id = managers.id
        WHERE 
            departments.id = ${departmentId}
        ORDER BY employees.last_name, employees.first_name`);
    console.table(result.rows);
}

async function viewEmployeesByManager(): Promise<void> {
    const managers = await pool.query(
        `SELECT id, first_name || ' ' || last_name AS name 
         FROM employees 
         WHERE id IN (SELECT manager_id FROM employees)`);
    if (managers.rowCount === 0) {
        throw "No managers have been defined.";
    }
    const answer = await inquirer.prompt([
        {
            name: "manager",
            message: "Manager",
            type: "list",
            choices: managers.rows.map(element => element.name)
        }    
    ]);
    const managerId = 
    managers.rows.find(
      element => element.name == answer.manager
     ).id;
    const result = await pool.query(
        `SELECT
            employees.first_name,
            employees.last_name,
            roles.title AS title,
            departments.name AS department,
            managers.first_name || ' ' || managers.last_name AS manager
        FROM
            employees JOIN roles
            ON role_id = roles.id 
            JOIN departments
            ON department_id = departments.id
            LEFT JOIN employees AS managers
            ON employees.manager_id = managers.id
        WHERE 
            employees.manager_id = ${managerId}
        ORDER BY employees.last_name, employees.first_name`);
    console.table(result.rows);
}

async function addDepartment(): Promise<void> {
    const answer = await inquirer.prompt([
        {
            name: 'department',
            message: 'Enter department name',
            type: 'input',
            required: true
        }
    ]);
    await pool.query(
        `INSERT INTO departments(name) 
         VALUES ('${answer.department}');`)
    console.log('Added department.')
}

async function addRole(): Promise<void> {
  const departments = await pool.query(
    'SELECT id,name from departments');
  if (departments.rowCount == 0) {
    throw "Must add department(s) first"
  }
  const answers = await inquirer.prompt([
      {
        name: "title",
        message: "Title",
        type: "input",
        required: true
      },
      {
        name: "salary",
        message: "Salary",
        type: "input",
        validate: input => isNaN(Number(input)) ?
                            "Please enter a number" : true
      },
      {
        name: "department",
        message: "Department",
        type: "list",
        choices: departments.rows.map(element => element.name)
      }
  ]);
  const departmentId = 
           departments.rows.find(
             element => element.name == answers.department
            ).id;
  await pool.query(`INSERT INTO roles
                        (title, salary, department_id)
                    VALUES(
                        '${answers.title}',
                        ${answers.salary},
                        ${departmentId}
                    )`)
  console.log('Added role.');
}

async function addEmployee(): Promise<void> {
    const roles = await pool.query(
        `SELECT 
            roles.id, 
            title || '(' || departments.name || ')' AS title
        FROM
            roles JOIN departments 
            ON roles.department_id = departments.id`);
    if (roles.rowCount == 0) {
        throw "Must add role(s) first";
    }
    const managers = await pool.query(
        `SELECT id, first_name || ' ' || last_name AS name 
         FROM employees`);
    managers.rows.push({id: 'NULL', name:'(none)'})
    // console.log('managers', managers.rows)
    const answers = await inquirer.prompt([
        {
            name: 'firstName',
            message: "First Name",
            type: 'input',
            required: true
        },
        {
            name: 'lastName',
            message: 'Last Name',
            type: 'input',
            required: true
        },
        {
            name: 'title',
            message: "Title",
            type: 'list',
            choices: roles.rows.map(entry => entry.title)
        },
        {
            name: 'manager',
            message: 'Manager',
            type: 'list',
            choices: managers.rows.map(entry => entry.name)
        }
    ])
    // console.log('answers.manager',answers.manager);
    const roleId = roles.rows.find(entry => entry.title === answers.title).id;
    const managerId = managers.rows.find(entry => entry.name === answers.manager).id;
    // console.log('manager id', managerId);
    await pool.query(`
        INSERT INTO employees(
            first_name, 
            last_name, 
            role_id, 
            manager_id) 
        VALUES (
            '${answers.firstName}',
            '${answers.lastName}',
            ${roleId},
            ${managerId}     
        );`)
    console.log('Added employee.');
}

async function updateRole(): Promise<void> {
    const employees = await pool.query(
        `select id, first_name || ' ' || last_name AS name FROM employees`);
    if (employees.rowCount == 0) {
        throw 'No employees added yet';
    }
    const managers = employees.rows.map(entry => entry)
    managers.push({id: 'NULL', name:'(none)'})
    const roles = await pool.query(
        `SELECT 
            roles.id, 
            title || '(' || departments.name || ')' AS title
        FROM
            roles JOIN departments 
            ON roles.department_id = departments.id`);
    const answers = await inquirer.prompt([
        {
            name : 'employee',
            message : "Employee",
            type: 'list',
            choices: employees.rows.map(entry => entry.name)
        },
        {
            name: 'role',
            message: "Role",
            type: "list",
            choices: roles.rows.map(entry => entry.title)
        },
        {
            name: 'manager',
            message: "Manager",
            type: "list",
            choices: managers.map(entry => entry.name)
        }
    ]);
    const roleId = roles.rows.find(entry => entry.title === answers.role).id;
    const employeeId = employees.rows.find(entry => entry.name === answers.employee).id;
    const managerId = managers.find(entry => entry.name === answers.manager).id;
    // console.log('employee id', employeeId);
    // console.log('manager id ' , managerId);
    if (managerId === employeeId) {
        throw 'An employee cannot report to themself.'
    }
    await pool.query(`
        UPDATE employees SET
            role_id = ${roleId},
            manager_id = ${managerId}
        WHERE id = ${employeeId}
        `)
}

async function deleteDepartment(): Promise<void> {
    const departments = await pool.query(
        'SELECT id,name from departments');
      if (departments.rowCount == 0) {
        throw "No departments have been defined."
      }
    const answer = await inquirer.prompt([
        {
            name: "department",
            message: "Department",
            type: "list",
            choices: departments.rows.map(element => element.name)
        }    
    ]);
    const departmentId = 
       departments.rows.find(
          element => element.name == answer.department
       ).id;
    await pool.query(`DELETE FROM departments WHERE id = ${departmentId};`);
    console.log ('Deleted', answer.department);
}

async function deleteRole(): Promise<void> {
    const roles = await pool.query(
        `SELECT 
            roles.id, 
            title || '(' || departments.name || ')' AS title
        FROM
            roles JOIN departments 
            ON roles.department_id = departments.id`);
    if (roles.rowCount === 0) {
        throw 'No roles have been defined.'
    }
    const answer = await inquirer.prompt([
        {
            name: 'role',
            message: "Role",
            type: "list",
            choices: roles.rows.map(entry => entry.title)
        }
    ]);
    const roleId = roles.rows.find(entry => entry.title === answer.role).id;    
    await pool.query(`DELETE FROM roles WHERE id = ${roleId}`);
    console.log('Deleted', answer.role);
}

async function deleteEmployee(): Promise<void> {
    const employees = await pool.query(
        `select id, first_name || ' ' || last_name AS name FROM employees`);
    if (employees.rowCount == 0) {
        throw 'No employees added yet';
    }
    const answer = await inquirer.prompt([
        {
            name : 'employee',
            message : "Employee",
            type: 'list',
            choices: employees.rows.map(entry => entry.name)
        }
    ]);
    const employeeId = employees.rows.find(entry => entry.name === answer.employee).id;
    await pool.query(`DELETE from employees WHERE id = ${employeeId}`);
    console.log('Deleted', answer.employee);
}

async function viewDepartmentBudget(): Promise<void> {
    const departments = await pool.query(
        'SELECT id,name from departments');
      if (departments.rowCount == 0) {
        throw "No departments have been defined.";
      }
    const answer = await inquirer.prompt([
        {
            name: "department",
            message: "Department",
            type: "list",
            choices: departments.rows.map(element => element.name)
        }    
    ]);
    const departmentId = 
       departments.rows.find(
          element => element.name == answer.department
       ).id;
    const result = await pool.query(`
        SELECT SUM(salary) AS budget
        FROM employees JOIN roles
            ON role_id = roles.id
        WHERE roles.department_id = ${departmentId}
        GROUP BY roles.department_id;
        `);
    if (result.rowCount === 0) {
        console.log(`No budget for ${answer.department}.`)
    }
    else {
        console.log (`${answer.department} budget is ${result.rows[0].budget}.`);
    }
}

async function performAction(): Promise<void> {
    // console.log ("entering performAction");
    const answer = await inquirer.prompt([
    {
        type : "list",
        message : "What would you like to do? ",
        name : "action",
        choices : [
            "view all departments", 
            "view all roles", 
            "view all employees", 
            "view employees by manager", 
            "view employees by department", 
            "add a department", 
            "add a role", 
            "add an employee", 
            "update an employee role/manager",
            "delete a department",
            "delete a role",
            "delete an employee",
            "view department budget",
            "exit"
        ]
    },
    ]);
    console.log(answer.action);
    try {
        switch (answer.action) {
        case "view all departments":
            // console.log("calling viewAllDepartments")
            await viewAllDepartments();
            // console.log("viewAllDepartments returned")
            break;
        case "view all roles": 
        await viewAllRoles();
        break;
        case "view all employees":
            await viewAllEmployees();
            break;
        case "view employees by manager":
            await viewEmployeesByManager();
            break;
        case "view employees by department":
            await viewEmployeesByDepartment();
            break;
    
        case "add a department":
            await addDepartment();
            break;
        case "add a role":
            await addRole();
            break;
        case "add an employee":
            await addEmployee();
            break;

        case "update an employee role/manager":
            await updateRole();
            break;

        case "delete a department":
            await deleteDepartment();
            break;
        case "delete a role":
            await deleteRole();
            break;
        case "delete an employee":
            await deleteEmployee();
            break;
        case "view department budget":
            await viewDepartmentBudget();
            break;
        default: return;
        }
    } catch (err) {
        console.log("*** Error: ", err);
    }
    await performAction();
}

await connectToDb();

await performAction();

process.exit();
