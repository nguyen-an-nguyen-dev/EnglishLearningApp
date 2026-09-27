USE english_learning;

START TRANSACTION;

INSERT INTO stages (code, title, description, sort_order) VALUES
  ('stage-1', 'English Foundations', 'Build confidence with everyday beginner English.', 1),
  ('stage-2', 'Everyday English', 'Use English in common daily situations.', 2),
  ('stage-3', 'English in Action', 'Practice English for school, travel, and work.', 3)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  sort_order = VALUES(sort_order);

INSERT INTO lessons (stage_id, code, title, topic, sort_order) VALUES
  ((SELECT id FROM stages WHERE code = 'stage-1'), 's1-greetings', 'Greetings', 'Greetings', 1),
  ((SELECT id FROM stages WHERE code = 'stage-1'), 's1-introductions', 'Introductions', 'Introductions', 2),
  ((SELECT id FROM stages WHERE code = 'stage-1'), 's1-numbers', 'Numbers', 'Numbers', 3),
  ((SELECT id FROM stages WHERE code = 'stage-1'), 's1-family', 'Family', 'Family', 4),
  ((SELECT id FROM stages WHERE code = 'stage-2'), 's2-food', 'Food', 'Food', 1),
  ((SELECT id FROM stages WHERE code = 'stage-2'), 's2-shopping', 'Shopping', 'Shopping', 2),
  ((SELECT id FROM stages WHERE code = 'stage-2'), 's2-daily-activities', 'Daily Activities', 'Daily Activities', 3),
  ((SELECT id FROM stages WHERE code = 'stage-2'), 's2-transportation', 'Transportation', 'Transportation', 4),
  ((SELECT id FROM stages WHERE code = 'stage-3'), 's3-travel', 'Travel', 'Travel', 1),
  ((SELECT id FROM stages WHERE code = 'stage-3'), 's3-school', 'School', 'School', 2),
  ((SELECT id FROM stages WHERE code = 'stage-3'), 's3-hobbies', 'Hobbies', 'Hobbies', 3),
  ((SELECT id FROM stages WHERE code = 'stage-3'), 's3-job-interview', 'Job Interview', 'Job Interview', 4)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  topic = VALUES(topic),
  sort_order = VALUES(sort_order);

CREATE TEMPORARY TABLE seed_questions (
  lesson_code VARCHAR(80) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer VARCHAR(500) NOT NULL,
  distractor_one VARCHAR(500) NOT NULL,
  distractor_two VARCHAR(500) NOT NULL,
  PRIMARY KEY (lesson_code, sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO seed_questions (lesson_code, sort_order, question_text, correct_answer, distractor_one, distractor_two) VALUES
  ('s1-greetings', 1, 'Which greeting is commonly used in the morning?', 'Good morning', 'Good night', 'Goodbye'),
  ('s1-greetings', 2, 'Which phrase is a friendly way to say hello?', 'Hello', 'Sorry', 'Please'),
  ('s1-greetings', 3, 'What can you say when you are leaving for the night?', 'Good night', 'Good morning', 'Welcome'),
  ('s1-greetings', 4, 'Which question asks how someone feels?', 'How are you?', 'Where is the station?', 'What time is it?'),
  ('s1-greetings', 5, 'Which reply means that you feel well?', 'I am fine, thank you.', 'My name is fine.', 'Fine is the station.'),
  ('s1-greetings', 6, 'What do you say after someone helps you?', 'Thank you', 'Excuse me', 'Good night'),
  ('s1-greetings', 7, 'Which polite phrase can get someone''s attention?', 'Excuse me', 'See you yesterday', 'You are welcome'),
  ('s1-greetings', 8, 'How can you say goodbye to a friend you will meet tomorrow?', 'See you tomorrow', 'Nice to meet you', 'Good afternoon'),
  ('s1-greetings', 9, 'Which greeting is suitable in the afternoon?', 'Good afternoon', 'Good night', 'Goodbye'),
  ('s1-greetings', 10, 'Which is a casual greeting for a friend?', 'Hi', 'Thank you', 'Sorry'),
  ('s1-introductions', 1, 'How can you answer "What is your name?"', 'My name is Lina.', 'I am twenty years old.', 'I live near the park.'),
  ('s1-introductions', 2, 'Which sentence introduces yourself?', 'I am Daniel.', 'This is a pencil.', 'How much is it?'),
  ('s1-introductions', 3, 'Which question asks for a person''s name?', 'What is your name?', 'How much is it?', 'Where is my book?'),
  ('s1-introductions', 4, 'How can you introduce a friend named Maya?', 'This is my friend, Maya.', 'Maya is under the table.', 'I need a friend tomorrow.'),
  ('s1-introductions', 5, 'Which phrase is polite when meeting someone for the first time?', 'Nice to meet you.', 'Good night, yesterday.', 'I am your name.'),
  ('s1-introductions', 6, 'How can you tell someone where you are from?', 'I am from Canada.', 'I am at seven o''clock.', 'I am a blue bag.'),
  ('s1-introductions', 7, 'Which question asks about someone''s country or city?', 'Where are you from?', 'What are you eating?', 'How many books?'),
  ('s1-introductions', 8, 'How can you say what your job is?', 'I am a teacher.', 'I am on the table.', 'I am at six.'),
  ('s1-introductions', 9, 'Which phrase gives your age?', 'I am twelve years old.', 'My name is twelve.', 'I live twelve years.'),
  ('s1-introductions', 10, 'How can you ask someone to repeat their name?', 'Could you say your name again, please?', 'Could you eat your name, please?', 'Could you open your name, please?'),
  ('s1-numbers', 1, 'How do you write the number 7 in words?', 'seven', 'seventy', 'six'),
  ('s1-numbers', 2, 'What number comes after twelve?', 'thirteen', 'eleven', 'twenty'),
  ('s1-numbers', 3, 'How many items are in one dozen?', 'twelve', 'ten', 'twenty'),
  ('s1-numbers', 4, 'Which numeral matches "twenty-one"?', '21', '12', '20'),
  ('s1-numbers', 5, 'What is three plus four?', 'seven', 'six', 'eight'),
  ('s1-numbers', 6, 'Which number is greater: eighteen or eight?', 'eighteen', 'eight', 'They are equal.'),
  ('s1-numbers', 7, 'How do you spell the number 40?', 'forty', 'fourty', 'fourteen'),
  ('s1-numbers', 8, 'What number comes immediately before one hundred?', 'ninety-nine', 'one hundred and one', 'ninety'),
  ('s1-numbers', 9, 'What is half of ten?', 'five', 'four', 'six'),
  ('s1-numbers', 10, 'Which word means the number 0?', 'zero', 'one', 'ten'),
  ('s1-family', 1, 'What do you call your mother''s or father''s mother?', 'grandmother', 'aunt', 'cousin'),
  ('s1-family', 2, 'Who is your father''s brother?', 'uncle', 'nephew', 'grandfather'),
  ('s1-family', 3, 'What do you call the daughter of your parents?', 'sister', 'mother', 'niece'),
  ('s1-family', 4, 'Who is your aunt''s child?', 'cousin', 'grandparent', 'brother-in-law'),
  ('s1-family', 5, 'What is a male parent called?', 'father', 'son', 'uncle'),
  ('s1-family', 6, 'What is a female parent called?', 'mother', 'daughter', 'aunt'),
  ('s1-family', 7, 'Who is the son of your brother or sister?', 'nephew', 'uncle', 'grandson'),
  ('s1-family', 8, 'What do you call your parents'' parents?', 'grandparents', 'children', 'neighbors'),
  ('s1-family', 9, 'Which word means a male sibling?', 'brother', 'father', 'cousin'),
  ('s1-family', 10, 'What is the plural of "child"?', 'children', 'childs', 'childes'),
  ('s2-food', 1, 'Which food is usually made from milk and can be sliced?', 'cheese', 'rice', 'lettuce'),
  ('s2-food', 2, 'Which fruit is usually yellow and easy to peel?', 'banana', 'potato', 'onion'),
  ('s2-food', 3, 'What do people commonly use to eat soup?', 'a spoon', 'a comb', 'a key'),
  ('s2-food', 4, 'Which word describes food that has a lot of sugar?', 'sweet', 'salty', 'bitter'),
  ('s2-food', 5, 'What is the main ingredient in an omelet?', 'eggs', 'apples', 'bread'),
  ('s2-food', 6, 'Which drink is made by brewing tea leaves in hot water?', 'tea', 'lemonade', 'milkshake'),
  ('s2-food', 7, 'Which vegetable is orange and often eaten raw?', 'carrot', 'cucumber', 'mushroom'),
  ('s2-food', 8, 'What do you call the midday meal?', 'lunch', 'breakfast', 'dessert'),
  ('s2-food', 9, 'Which phrase politely asks for food in a restaurant?', 'Could I see the menu, please?', 'Could I wear the menu, please?', 'Could I drive the menu, please?'),
  ('s2-food', 10, 'What does "I am thirsty" mean?', 'I want a drink.', 'I want to sleep.', 'I feel cold.'),
  ('s2-shopping', 1, 'Which question asks for the price of an item?', 'How much does this cost?', 'How tall is this?', 'How old is this shop?'),
  ('s2-shopping', 2, 'What do you usually carry groceries home in?', 'a shopping bag', 'a pillowcase', 'a toolbox'),
  ('s2-shopping', 3, 'What does a customer do at a checkout?', 'pays for the items', 'cooks the items', 'repairs the shop'),
  ('s2-shopping', 4, 'Which word means the money returned after paying too much?', 'change', 'receipt', 'shelf'),
  ('s2-shopping', 5, 'What can you ask if you cannot find a product?', 'Where can I find the bread?', 'When can I paint the bread?', 'Why can I borrow the bread?'),
  ('s2-shopping', 6, 'What does "on sale" usually mean in a shop?', 'Available at a lower price', 'Already eaten', 'Closed for the day'),
  ('s2-shopping', 7, 'Which document shows what you bought and paid?', 'a receipt', 'a recipe', 'a map'),
  ('s2-shopping', 8, 'What is the opposite of "expensive"?', 'cheap', 'heavy', 'wide'),
  ('s2-shopping', 9, 'What should you do to a jacket before buying it for size?', 'try it on', 'turn it off', 'fill it up'),
  ('s2-shopping', 10, 'Which phrase politely asks to pay by card?', 'Can I pay by card?', 'Can I wear the card?', 'Can I cook the card?'),
  ('s2-daily-activities', 1, 'What do you usually do after waking up?', 'get out of bed', 'go to sleep', 'eat dinner'),
  ('s2-daily-activities', 2, 'Which activity usually happens in the morning before work?', 'eat breakfast', 'eat midnight dinner', 'go to bed'),
  ('s2-daily-activities', 3, 'What does "brush your teeth" mean?', 'clean your teeth with a toothbrush', 'cut your hair', 'wash your shoes'),
  ('s2-daily-activities', 4, 'Which verb completes the sentence: "I ___ to work by bus"?', 'go', 'goes', 'going'),
  ('s2-daily-activities', 5, 'What do you usually do when you are tired at night?', 'go to bed', 'have breakfast', 'start work'),
  ('s2-daily-activities', 6, 'Which phrase means to prepare food?', 'cook dinner', 'read dinner', 'drive dinner'),
  ('s2-daily-activities', 7, 'When do people usually have lunch?', 'around the middle of the day', 'before they wake up', 'in the middle of the night'),
  ('s2-daily-activities', 8, 'Which activity keeps a room clean?', 'tidy the room', 'borrow the room', 'invite the room'),
  ('s2-daily-activities', 9, 'Which sentence describes a regular habit?', 'She walks to school every day.', 'She walked to school tomorrow.', 'She walking school yesterday.'),
  ('s2-daily-activities', 10, 'What does "take a shower" mean?', 'wash your body under running water', 'take a photograph', 'carry water to work'),
  ('s2-transportation', 1, 'Where do passengers wait for a train?', 'at a train station', 'at a library', 'at a bakery'),
  ('s2-transportation', 2, 'Which vehicle travels on rails?', 'a train', 'a bicycle', 'a boat'),
  ('s2-transportation', 3, 'Where can you catch a bus?', 'at a bus stop', 'at a bus kitchen', 'at a bus bedroom'),
  ('s2-transportation', 4, 'Which vehicle has two wheels and pedals?', 'a bicycle', 'a taxi', 'a plane'),
  ('s2-transportation', 5, 'What does a traffic light tell drivers?', 'when to stop or go', 'what to eat', 'where to sleep'),
  ('s2-transportation', 6, 'Which word means the place where a plane arrives or departs?', 'airport', 'harbor', 'stadium'),
  ('s2-transportation', 7, 'What should passengers do before a car moves?', 'fasten their seat belts', 'open their suitcases', 'take off their shoes'),
  ('s2-transportation', 8, 'Which question asks about a bus schedule?', 'When does the bus leave?', 'Who painted the bus?', 'Why is the bus hungry?'),
  ('s2-transportation', 9, 'What is a person who drives a taxi called?', 'a taxi driver', 'a taxi passenger', 'a taxi station'),
  ('s2-transportation', 10, 'Which direction is opposite to "left"?', 'right', 'straight', 'behind'),
  ('s3-travel', 1, 'What document do many travelers need to cross an international border?', 'a passport', 'a library card', 'a menu'),
  ('s3-travel', 2, 'Where do travelers collect their bags after a flight?', 'at baggage claim', 'at the check-in desk', 'at the departure gate'),
  ('s3-travel', 3, 'Which phrase asks where a hotel is located?', 'Could you tell me how to get to the hotel?', 'Could you tell me how to cook the hotel?', 'Could you tell me how to wear the hotel?'),
  ('s3-travel', 4, 'What is a reservation?', 'an arrangement made in advance', 'a meal eaten quickly', 'a ticket that has been lost'),
  ('s3-travel', 5, 'Which item protects you from rain while walking?', 'an umbrella', 'a passport', 'a suitcase'),
  ('s3-travel', 6, 'What does "return ticket" usually mean?', 'a ticket for a trip there and back', 'a ticket for a different person', 'a ticket for a museum only'),
  ('s3-travel', 7, 'Which question can you ask at a hotel reception?', 'Is breakfast included?', 'Is the train swimming?', 'Is my passport cooking?'),
  ('s3-travel', 8, 'What should you check to know when your flight leaves?', 'the departure time', 'the room temperature', 'the restaurant recipe'),
  ('s3-travel', 9, 'Which phrase asks for directions politely?', 'Excuse me, how do I get to the museum?', 'Excuse me, how do I eat the museum?', 'Excuse me, how do I sleep the museum?'),
  ('s3-travel', 10, 'What does "boarding pass" allow a traveler to do?', 'board an airplane', 'rent a hotel room', 'buy food at a market'),
  ('s3-school', 1, 'What do students use to write notes?', 'a notebook', 'a saucepan', 'a suitcase'),
  ('s3-school', 2, 'Who teaches students in a classroom?', 'a teacher', 'a passenger', 'a cashier'),
  ('s3-school', 3, 'What is a test?', 'a way to check what students have learned', 'a place to buy a ticket', 'a tool for cutting paper'),
  ('s3-school', 4, 'Which phrase asks permission to leave the classroom?', 'May I go out, please?', 'May I paint the teacher, please?', 'May I drive the classroom, please?'),
  ('s3-school', 5, 'What does "hand in your homework" mean?', 'give your completed work to the teacher', 'write your name on your hand', 'borrow a book from a friend'),
  ('s3-school', 6, 'Where can students find books to borrow at school?', 'in the library', 'in the cafeteria kitchen', 'in the parking lot'),
  ('s3-school', 7, 'Which subject studies numbers and calculations?', 'mathematics', 'music', 'geography'),
  ('s3-school', 8, 'What should you do if you do not understand a question?', 'ask the teacher for help', 'hide the question', 'leave the school immediately'),
  ('s3-school', 9, 'Which sentence is in the past tense?', 'We studied for the exam yesterday.', 'We study for the exam tomorrow.', 'We are study for the exam now.'),
  ('s3-school', 10, 'What does a class schedule show?', 'the times and subjects of lessons', 'the prices of school lunches', 'the names of nearby streets'),
  ('s3-hobbies', 1, 'Which hobby uses a camera to take pictures?', 'photography', 'gardening', 'baking'),
  ('s3-hobbies', 2, 'Which verb means to make music with a guitar?', 'play', 'read', 'grow'),
  ('s3-hobbies', 3, 'What do people do when they go hiking?', 'walk on trails outdoors', 'swim in a kitchen', 'write on a ticket'),
  ('s3-hobbies', 4, 'Which hobby involves growing flowers and vegetables?', 'gardening', 'painting', 'cycling'),
  ('s3-hobbies', 5, 'Which sentence describes a preference?', 'I enjoy reading novels.', 'I am reading yesterday.', 'I enjoy to novels.'),
  ('s3-hobbies', 6, 'What equipment is commonly used for cycling?', 'a bicycle and a helmet', 'a frying pan and a spoon', 'a passport and a pillow'),
  ('s3-hobbies', 7, 'What does "I am interested in painting" mean?', 'Painting is a hobby I like.', 'I want to buy a train ticket.', 'I do not know how to paint.'),
  ('s3-hobbies', 8, 'Which hobby can you do with a book and a quiet place?', 'reading', 'skating', 'swimming'),
  ('s3-hobbies', 9, 'How can you invite a friend to join your hobby?', 'Would you like to play tennis with me?', 'Would you like to become a tennis ball?', 'Would you like to close the tennis?'),
  ('s3-hobbies', 10, 'Which word means an activity someone enjoys in free time?', 'hobby', 'appointment', 'commute'),
  ('s3-job-interview', 1, 'Which phrase is a polite way to greet an interviewer?', 'Good morning, it is nice to meet you.', 'Give me the job right now.', 'You are late for my interview.'),
  ('s3-job-interview', 2, 'Which question asks about a candidate''s experience?', 'Could you tell me about your previous work?', 'Could you tell me about your breakfast?', 'Could you tell me about the weather last year?'),
  ('s3-job-interview', 3, 'How can you describe a skill you have?', 'I am skilled at organizing projects.', 'I am a skill for the office.', 'I skilled yesterday the project.'),
  ('s3-job-interview', 4, 'Which answer gives a professional reason for applying?', 'I am interested in the role and your company.', 'I applied because the office has chairs.', 'I am looking for a place to eat lunch.'),
  ('s3-job-interview', 5, 'What does "strength" mean in a job interview?', 'a quality or ability you do well', 'a task you refuse to do', 'the length of your commute'),
  ('s3-job-interview', 6, 'Which phrase asks the interviewer a question politely?', 'Could you describe the main responsibilities?', 'You must describe everything now.', 'Why are all the responsibilities?'),
  ('s3-job-interview', 7, 'Which sentence correctly describes a past job?', 'I worked as a sales assistant for two years.', 'I work as a sales assistant last year.', 'I working as a sales assistant for two years.'),
  ('s3-job-interview', 8, 'How can you show that you listened to a question?', 'That is a good question. I would say...', 'I did not hear anything, goodbye.', 'Your question is my answer.'),
  ('s3-job-interview', 9, 'Which phrase is suitable at the end of an interview?', 'Thank you for your time.', 'Give me your time back.', 'I am interviewing you now.'),
  ('s3-job-interview', 10, 'Which response gives a clear availability date?', 'I can start on the first of June.', 'I can start when the chair is blue.', 'I started tomorrow last week.');

INSERT INTO questions (lesson_id, question_text, question_type, difficulty, sort_order)
SELECT l.id, seed.question_text, 'multiple_choice', 'beginner', seed.sort_order
FROM seed_questions AS seed
JOIN lessons AS l ON l.code = seed.lesson_code
WHERE TRUE
ON DUPLICATE KEY UPDATE
  question_text = VALUES(question_text),
  question_type = VALUES(question_type),
  difficulty = VALUES(difficulty);

INSERT INTO answers (question_id, answer_text, is_correct, sort_order)
SELECT q.id, choice.answer_text, choice.is_correct, choice.sort_order
FROM seed_questions AS seed
JOIN lessons AS l ON l.code = seed.lesson_code
JOIN questions AS q ON q.lesson_id = l.id AND q.sort_order = seed.sort_order
CROSS JOIN JSON_TABLE(
  JSON_ARRAY(
    JSON_OBJECT('answer_text', seed.correct_answer, 'is_correct', TRUE),
    JSON_OBJECT('answer_text', seed.distractor_one, 'is_correct', FALSE),
    JSON_OBJECT('answer_text', seed.distractor_two, 'is_correct', FALSE)
  ),
  '$[*]' COLUMNS (
    sort_order FOR ORDINALITY,
    answer_text VARCHAR(500) PATH '$.answer_text',
    is_correct BOOLEAN PATH '$.is_correct'
  )
) AS choice
WHERE TRUE
ON DUPLICATE KEY UPDATE
  is_correct = VALUES(is_correct),
  sort_order = VALUES(sort_order);

COMMIT;