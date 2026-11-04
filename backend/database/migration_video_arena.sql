-- ============================================================================
-- Migration: Word Battle vocabulary bank + Video learning
-- Safe to run more than once: every object is created / inserted idempotently.
-- ============================================================================

CREATE TABLE IF NOT EXISTS battle_words (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  word_en VARCHAR(64) NOT NULL,
  translation_vi VARCHAR(160) NOT NULL,
  part_of_speech ENUM('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection') NOT NULL,
  cefr_level ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2') NOT NULL,
  explanation_vi VARCHAR(500) NOT NULL,
  example_en VARCHAR(300) NOT NULL,
  example_vi VARCHAR(300) NOT NULL,
  image_url VARCHAR(500) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_battle_words_word (word_en),
  UNIQUE KEY uq_battle_words_sort_order (sort_order),
  KEY idx_battle_words_cefr (cefr_level)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO battle_words
  (word_en, translation_vi, part_of_speech, cefr_level, explanation_vi, example_en, example_vi, image_url, sort_order) VALUES
  ('apple', 'quả táo', 'noun', 'A1', 'Trái cây tròn vị ngọt, thường có vỏ màu đỏ hoặc xanh lá.', 'She puts an apple in her lunch box every morning.', 'Cô ấy đặt một quả táo vào hộp cơm mỗi sáng.', NULL, 1),
  ('water', 'nước', 'noun', 'A1', 'Chất lỏng không màu không mùi mà con người cần uống để sống.', 'Drink a glass of water before breakfast.', 'Hãy uống một ly nước trước bữa sáng.', NULL, 2),
  ('house', 'ngôi nhà', 'noun', 'A1', 'Công trình xây dựng để ở, có tường và mái.', 'Their house has a small garden at the back.', 'Nhà của họ có một khu vườn nhỏ phía sau.', NULL, 3),
  ('friend', 'người bạn', 'noun', 'A1', 'Người mà bạn tin tưởng và muốn ở cùng.', 'My best friend lives next door.', 'Bạn thân nhất của tôi sống ngay cạnh nhà.', NULL, 4),
  ('book', 'quyển sách', 'noun', 'A1', 'Tập giấy có in chữ, dùng để đọc và học.', 'I finished a book about ancient cities.', 'Tôi vừa đọc xong một cuốn sách về các thành phố cổ.', NULL, 5),
  ('school', 'trường học', 'noun', 'A1', 'Nơi học sinh tới học và gặp giáo viên.', 'School starts at eight in the morning.', 'Trường bắt đầu lúc tám giờ sáng.', NULL, 6),
  ('mother', 'người mẹ', 'noun', 'A1', 'Người phụ nữ sinh ra và nuôi dưỡng mình.', 'My mother cooks the best noodle soup.', 'Mẹ tôi nấu bún ngon nhất.', NULL, 7),
  ('dog', 'con chó', 'noun', 'A1', 'Động vật bốn chân nuôi trong nhà, rất trung thành.', 'The dog barks when someone rings the bell.', 'Con chó sủa khi có người nhấn chuông.', NULL, 8),
  ('red', 'màu đỏ', 'adjective', 'A1', 'Màu của máu hoặc lửa, nổi bật và dễ nhìn thấy.', 'She wore a red coat to the party.', 'Cô ấy mặc chiếc áo khoác đỏ tới bữa tiệc.', NULL, 9),
  ('big', 'to lớn', 'adjective', 'A1', 'Có kích thước hoặc mức độ vượt hơn bình thường.', 'They live in a big apartment near the park.', 'Họ sống trong một căn hộ lớn gần công viên.', NULL, 10),
  ('small', 'nhỏ', 'adjective', 'A1', 'Chiếm ít diện tích hoặc ít hơn mức bình thường.', 'A small cat slept under the table.', 'Một con mèo nhỏ ngủ dưới gầm bàn.', NULL, 11),
  ('eat', 'ăn', 'verb', 'A1', 'Đưa thức ăn vào miệng rồi nhai và nuốt.', 'We eat dinner together at seven.', 'Chúng tôi ăn tối cùng nhau lúc bảy giờ.', NULL, 12),
  ('drink', 'uống', 'verb', 'A1', 'Nuốt chất lỏng để giải khát.', 'He likes to drink tea after lunch.', 'Anh ấy thích uống trà sau bữa trưa.', NULL, 13),
  ('sleep', 'ngủ', 'verb', 'A1', 'Nghỉ ngơi trong trạng thái nhắm mắt và không tỉnh táo.', 'Babies sleep for sixteen hours a day.', 'Trẻ sơ sinh ngủ tới mười sáu tiếng mỗi ngày.', NULL, 14),
  ('run', 'chạy', 'verb', 'A1', 'Di chuyển nhanh hơn đi bộ bằng cả hai chân.', 'She runs in the park every sunrise.', 'Cô ấy chạy trong công viên mỗi lúc bình minh.', NULL, 15),
  ('weather', 'thời tiết', 'noun', 'A2', 'Tình trạng nắng, mưa, nóng, lạnh của một ngày ở một nơi.', 'The weather is warm and sunny today.', 'Hôm nay thời tiết ấm áp và có nắng.', NULL, 16),
  ('ticket', 'tấm vé', 'noun', 'A2', 'Tờ giấy hoặc mã cho phép bạn đi tàu, xe hoặc vào xem.', 'I bought a train ticket online.', 'Tôi đã mua một vé tàu trực tuyến.', NULL, 17),
  ('holiday', 'kỳ nghỉ', 'noun', 'A2', 'Khoảng thời gian bạn nghỉ làm hoặc nghỉ học để thư giãn.', 'We are planning a holiday on the island.', 'Chúng tôi đang lên kế hoạch cho một kỳ nghỉ trên đảo.', NULL, 18),
  ('bridge', 'cây cầu', 'noun', 'A2', 'Công trình bắc ngang qua sông, đường hoặc thung lũng.', 'The old bridge connects two small villages.', 'Cây cầu cũ nối hai ngôi làng nhỏ.', NULL, 19),
  ('crowded', 'đông đúc', 'adjective', 'A2', 'Có quá nhiều người hoặc xe trong cùng một không gian.', 'The market is crowded on weekend mornings.', 'Chợ rất đông đúc vào các buổi sáng cuối tuần.', NULL, 20),
  ('expensive', 'đắt đỏ', 'adjective', 'A2', 'Tốn nhiều tiền hơn mức bạn muốn chi trả.', 'That restaurant is too expensive for us.', 'Nhà hàng đó quá đắt so với chúng tôi.', NULL, 21),
  ('cheap', 'rẻ', 'adjective', 'A2', 'Có giá thấp hơn mức bình thường.', 'These shoes were cheap but very comfortable.', 'Đôi giày này rẻ nhưng đi rất êm.', NULL, 22),
  ('borrow', 'mượn', 'verb', 'A2', 'Dùng đồ của người khác trong một thời gian rồi trả lại.', 'Can I borrow your pen for a minute?', 'Tôi có thể mượn bút của bạn một phút không?', NULL, 23),
  ('travel', 'đi du lịch', 'verb', 'A2', 'Di chuyển tới một thành phố hay quốc gia khác.', 'They travel by train across the country.', 'Họ đi tàu hỏa xuyên khắp đất nước.', NULL, 24),
  ('listen', 'lắng nghe', 'verb', 'A2', 'Chú ý dùng tai để thu nhận âm thanh.', 'Listen to the teacher and repeat the sentence.', 'Hãy nghe cô giáo rồi lặp lại câu đó.', NULL, 25),
  ('early', 'sớm', 'adverb', 'A2', 'Xảy ra trước hoặc ngay lúc bắt đầu khoảng thời gian dự kiến.', 'She gets up early to catch the bus.', 'Cô ấy dậy sớm để kịp chuyến xe buýt.', NULL, 26),
  ('usually', 'thường thường', 'adverb', 'A2', 'Diễn ra theo thói quen, phần lớn thời gian đều như vậy.', 'I usually walk to work in the morning.', 'Buổi sáng tôi thường đi bộ tới chỗ làm.', NULL, 27),
  ('money', 'tiền bạc', 'noun', 'A2', 'Giấy hoặc đồng tiền dùng để mua bán hàng hóa.', 'He saves a little money every month.', 'Anh ấy tiết kiệm một ít tiền mỗi tháng.', NULL, 28),
  ('window', 'cửa sổ', 'noun', 'A2', 'Phần kính mở được trên tường để ánh sáng vào phòng.', 'Rain hit the window all night.', 'Mưa gõ lên cửa sổ suốt cả đêm.', NULL, 29),
  ('happy', 'vui vẻ', 'adjective', 'A2', 'Cảm thấy hài lòng, thích thú và không buồn.', 'The children were happy to see the snow.', 'Lũ trẻ rất vui khi nhìn thấy tuyết.', NULL, 30),
  ('advice', 'lời khuyên', 'noun', 'B1', 'Điều bạn nói để ai đó biết nên làm gì.', 'She gave me useful advice about job interviews.', 'Cô ấy cho tôi lời khuyên hữu ích về phỏng vấn xin việc.', NULL, 31),
  ('habit', 'thói quen', 'noun', 'B1', 'Việc bạn lặp đi lặp lại nhiều lần đến mức thành phản xạ.', 'Reading before bed is a good habit.', 'Đọc sách trước khi ngủ là một thói quen tốt.', NULL, 32),
  ('journey', 'chuyến đi', 'noun', 'B1', 'Quãng đường dài bạn đi từ nơi này tới nơi khác.', 'The train journey took six hours.', 'Chuyến đi bằng tàu mất sáu tiếng.', NULL, 33),
  ('opportunity', 'cơ hội', 'noun', 'B1', 'Thời điểm thuận lợi để làm điều bạn vẫn mong muốn.', 'Studying abroad was a great opportunity for him.', 'Du học là một cơ hội tuyệt vời cho anh ấy.', NULL, 34),
  ('confident', 'tự tin', 'adjective', 'B1', 'Tin tưởng vào khả năng của chính mình.', 'She sounds confident when she speaks in public.', 'Cô ấy rất tự tin khi nói trước đám đông.', NULL, 35),
  ('dangerous', 'nguy hiểm', 'adjective', 'B1', 'Có thể gây thương tích hoặc thiệt hại.', 'It is dangerous to swim in this river.', 'Bơi trên con sông này rất nguy hiểm.', NULL, 36),
  ('popular', 'phổ biến', 'adjective', 'B1', 'Được nhiều người yêu thích hoặc sử dụng.', 'This app is popular among students.', 'Ứng dụng này rất phổ biến trong học sinh.', NULL, 37),
  ('improve', 'cải thiện', 'verb', 'B1', 'Làm cho một thứ tốt hơn so với trước đây.', 'He practices daily to improve his pronunciation.', 'Anh ấy luyện tập mỗi ngày để cải thiện phát âm.', NULL, 38),
  ('arrange', 'sắp xếp', 'verb', 'B1', 'Đặt các thứ vào đúng vị trí hoặc lên kế hoạch cho việc gì đó.', 'Let me arrange the chairs before the guests arrive.', 'Để tôi sắp xếp ghế trước khi khách tới.', NULL, 39),
  ('refuse', 'từ chối', 'verb', 'B1', 'Không đồng ý làm điều người khác yêu cầu.', 'They refused to answer the last question.', 'Họ từ chối trả lời câu hỏi cuối cùng.', NULL, 40),
  ('agree', 'đồng ý', 'verb', 'B1', 'Có chung ý kiến với ai đó.', 'I agree with your idea about the plan.', 'Tôi đồng ý với ý tưởng của bạn về kế hoạch.', NULL, 41),
  ('recently', 'gần đây', 'adverb', 'B1', 'Xảy ra trong một thời gian ngắn trước hiện tại.', 'We recently moved to a new neighborhood.', 'Gần đây chúng tôi chuyển tới khu phố mới.', NULL, 42),
  ('carefully', 'một cách cẩn thận', 'adverb', 'B1', 'Làm với sự chú ý cao để không mắc sai lầm.', 'Read the instructions carefully before you start.', 'Hãy đọc kỹ hướng dẫn trước khi bắt đầu.', NULL, 43),
  ('environment', 'môi trường', 'noun', 'B1', 'Những thứ xung quanh con người, gồm thiên nhiên và xã hội.', 'Plastic waste harms the environment.', 'Rác thải nhựa gây hại cho môi trường.', NULL, 44),
  ('knowledge', 'kiến thức', 'noun', 'B1', 'Hiểu biết bạn có được nhờ học hỏi và trải nghiệm.', 'Her knowledge of history impresses everyone.', 'Kiến thức lịch sử của cô ấy khiến mọi người ngưỡng mộ.', NULL, 45),
  ('experience', 'kinh nghiệm', 'noun', 'B1', 'Hiểu biết có được do đã từng làm việc đó.', 'He has ten years of experience in teaching.', 'Thầy ấy có mười năm kinh nghiệm giảng dạy.', NULL, 46),
  ('achieve', 'đạt được', 'verb', 'B1', 'Làm thành công điều mình đã cố gắng hướng tới.', 'She worked hard to achieve her goals.', 'Cô ấy làm việc chăm chỉ để đạt được mục tiêu.', NULL, 47),
  ('compare', 'so sánh', 'verb', 'B1', 'Xem hai hay nhiều thứ giống và khác nhau thế nào.', 'Do not compare yourself with other learners.', 'Đừng so sánh bản thân với những người học khác.', NULL, 48),
  ('decide', 'quyết định', 'verb', 'B1', 'Suy nghĩ kỹ để chọn một hướng đi.', 'We need to decide before Friday.', 'Chúng ta cần quyết định trước thứ Sáu.', NULL, 49),
  ('patient', 'kiên nhẫn', 'adjective', 'B1', 'Bình tĩnh chờ đợi mà không bực bội.', 'A teacher must be patient with beginners.', 'Giáo viên phải kiên nhẫn với người mới học.', NULL, 50),
  ('behavior', 'hành vi', 'noun', 'B2', 'Cách một người cư xử và phản ứng với người khác.', 'His behavior in class improved a lot.', 'Hành vi của cậu ấy trong lớp đã tiến bộ nhiều.', NULL, 51),
  ('consequence', 'hậu quả', 'noun', 'B2', 'Kết quả tự nhiên xảy ra từ một hành động.', 'Skipping practice has serious consequences for your score.', 'Bỏ tập luyện gây hậu quả nghiêm trọng cho điểm số.', NULL, 52),
  ('pressure', 'áp lực', 'noun', 'B2', 'Sức ép tinh thần khi phải làm điều khó khăn.', 'Many students feel pressure before exams.', 'Nhiều học sinh cảm thấy áp lực trước kỳ thi.', NULL, 53),
  ('achievement', 'thành tựu', 'noun', 'B2', 'Điều quan trọng bạn đạt được sau nỗ lực lớn.', 'Finishing the project was a real achievement.', 'Hoàn thành dự án là một thành tựu thực sự.', NULL, 54),
  ('responsible', 'có trách nhiệm', 'adjective', 'B2', 'Sẵn sàng chịu trách nhiệm về việc mình làm.', 'She is responsible for the weekly report.', 'Cô ấy chịu trách nhiệm cho báo cáo hằng tuần.', NULL, 55),
  ('significant', 'đáng kể', 'adjective', 'B2', 'Đủ lớn hoặc quan trọng để tạo ra sự khác biệt.', 'There was a significant change in his writing.', 'Có sự thay đổi đáng kể trong bài viết của cậu ấy.', NULL, 56),
  ('reluctant', 'miễn cưỡng', 'adjective', 'B2', 'Không muốn làm điều gì đó nên hay do dự.', 'He was reluctant to speak in front of strangers.', 'Cậu ấy miễn cưỡng khi phải nói trước người lạ.', NULL, 57),
  ('accurate', 'chính xác', 'adjective', 'B2', 'Đúng với thực tế, không có sai số.', 'The translation must be accurate and natural.', 'Bản dịch phải chính xác và tự nhiên.', NULL, 58),
  ('persuade', 'thuyết phục', 'verb', 'B2', 'Khiến ai đó đồng ý bằng lý lẽ hoặc cảm xúc.', 'They persuaded us to join the club.', 'Họ đã thuyết phục chúng tôi tham gia câu lạc bộ.', NULL, 59),
  ('postpone', 'trì hoãn', 'verb', 'B2', 'Dời việc gì đó sang thời điểm muộn hơn.', 'We had to postpone the meeting until Monday.', 'Chúng tôi phải hoãn cuộc họp tới thứ Hai.', NULL, 60),
  ('evaluate', 'đánh giá', 'verb', 'B2', 'Xem xét kỹ để đưa ra nhận định về chất lượng.', 'Teachers evaluate each essay against clear criteria.', 'Giáo viên đánh giá từng bài viết theo tiêu chí rõ ràng.', NULL, 61),
  ('maintain', 'duy trì', 'verb', 'B2', 'Giữ cho một trạng thái tiếp tục tồn tại.', 'It is hard to maintain focus for three hours.', 'Rất khó để duy trì sự tập trung suốt ba tiếng.', NULL, 62),
  ('occasionally', 'thỉnh thoảng', 'adverb', 'B2', 'Xảy ra đôi khi nhưng không thường xuyên.', 'We occasionally eat out on Friday nights.', 'Chúng tôi thỉnh thoảng ăn ngoài vào tối thứ Sáu.', NULL, 63),
  ('apparently', 'dường như', 'adverb', 'B2', 'Theo những gì bạn nghe hoặc thấy, chưa chắc đã đúng.', 'Apparently the library closes earlier on Sunday.', 'Dường như thư viện đóng cửa sớm hơn vào Chủ nhật.', NULL, 64),
  ('budget', 'ngân sách', 'noun', 'B2', 'Số tiền bạn dự tính chi cho một việc.', 'We kept the trip within a small budget.', 'Chúng tôi giữ chuyến đi trong một ngân sách nhỏ.', NULL, 65),
  ('colleague', 'đồng nghiệp', 'noun', 'B2', 'Người làm cùng bạn tại một cơ quan.', 'My colleague helped me finish the report.', 'Đồng nghiệp của tôi đã giúp tôi hoàn thành báo cáo.', NULL, 66),
  ('equipment', 'trang thiết bị', 'noun', 'B2', 'Đồ dùng và máy móc cần có cho một công việc.', 'The lab has new equipment for testing.', 'Phòng thí nghiệm có trang thiết bị mới để thử nghiệm.', NULL, 67),
  ('purpose', 'mục đích', 'noun', 'B2', 'Lý do bạn làm một việc gì đó.', 'The purpose of this lesson is to build vocabulary.', 'Mục đích của bài học này là mở rộng vốn từ.', NULL, 68),
  ('complain', 'phàn nàn', 'verb', 'B2', 'Nói ra rằng bạn không hài lòng về điều gì.', 'Guests often complain about the noise.', 'Khách thường phàn nàn về tiếng ồn.', NULL, 69),
  ('recommend', 'khuyên dùng', 'verb', 'B2', 'Nói rằng một thứ đáng để thử hoặc nên dùng.', 'Can you recommend a good dictionary app?', 'Bạn có thể giới thiệu một ứng dụng từ điển tốt không?', NULL, 70),
  ('ambiguity', 'sự mơ hồ', 'noun', 'C1', 'Việc một câu hoặc tình huống có thể bị hiểu theo nhiều nghĩa.', 'The instructions were written without ambiguity.', 'Hướng dẫn được viết mà không có sự mơ hồ.', NULL, 71),
  ('constraint', 'ràng buộc', 'noun', 'C1', 'Giới hạn về thời gian hoặc tiền bạc khiến việc gì đó khó làm.', 'We designed the course under a tight budget constraint.', 'Chúng tôi thiết kế khóa học trong ràng buộc ngân sách chặt chẽ.', NULL, 72),
  ('incentive', 'động lực khuyến khích', 'noun', 'C1', 'Thứ được đưa ra để thúc đẩy ai đó hành động.', 'The company offers an incentive for every new idea.', 'Công ty trao phần thưởng khuyến khích cho mỗi ý tưởng mới.', NULL, 73),
  ('criterion', 'tiêu chí', 'noun', 'C1', 'Chuẩn mực dùng để đánh giá hoặc ra quyết định.', 'Fluency is not the only criterion for a good speaker.', 'Trôi chảy không phải tiêu chí duy nhất của người nói giỏi.', NULL, 74),
  ('comprehensive', 'toàn diện', 'adjective', 'C1', 'Bao quát hầu hết mọi phần của một vấn đề.', 'The school prepared a comprehensive study plan.', 'Nhà trường chuẩn bị một kế hoạch học tập toàn diện.', NULL, 75),
  ('controversial', 'gây tranh cãi', 'adjective', 'C1', 'Khiến nhiều người bất đồng và phản đối.', 'The new rule remains controversial among parents.', 'Quy định mới vẫn gây tranh cãi trong phụ huynh.', NULL, 76),
  ('inevitable', 'không thể tránh khỏi', 'adjective', 'C1', 'Chắc chắn sẽ xảy ra cho dù bạn làm gì.', 'Making mistakes is inevitable when learning a language.', 'Mắc lỗi là điều không thể tránh khỏi khi học ngoại ngữ.', NULL, 77),
  ('subtle', 'tinh tế', 'adjective', 'C1', 'Rất nhỏ hoặc nhẹ nên khó nhận ra.', 'There is a subtle difference between these two words.', 'Có sự khác biệt tinh tế giữa hai từ này.', NULL, 78),
  ('accumulate', 'tích lũy', 'verb', 'C1', 'Gom lại nhiều hơn dần theo thời gian.', 'Dust accumulates on books that nobody reads.', 'Bụi tích tụ trên những cuốn sách không ai đọc.', NULL, 79),
  ('diminish', 'suy giảm', 'verb', 'C1', 'Trở nên nhỏ hơn hoặc ít quan trọng hơn.', 'Regular practice diminishes the fear of speaking.', 'Luyện tập thường xuyên làm giảm nỗi sợ khi nói.', NULL, 80),
  ('facilitate', 'tạo điều kiện', 'verb', 'C1', 'Làm cho một quá trình diễn ra dễ dàng hơn.', 'Good lighting facilitates focused study.', 'Ánh sáng tốt tạo điều kiện cho việc học tập trung.', NULL, 81),
  ('undermine', 'làm suy yếu', 'verb', 'C1', 'Từ từ phá hỏng niềm tin hoặc hiệu quả của điều gì.', 'Constant criticism can undermine a learner''s confidence.', 'Chỉ trích liên tục có thể làm suy yếu sự tự tin của người học.', NULL, 82),
  ('explicitly', 'một cách rõ ràng', 'adverb', 'C1', 'Nói thẳng ra, không để người khác phải đoán.', 'The teacher explained the rules explicitly.', 'Thầy giáo giải thích nội quy một cách rõ ràng.', NULL, 83),
  ('reluctantly', 'một cách miễn cưỡng', 'adverb', 'C1', 'Làm điều gì dù trong lòng không muốn.', 'He reluctantly agreed to redo the exercise.', 'Cậu ấy miễn cưỡng đồng ý làm lại bài tập.', NULL, 84),
  ('threshold', 'ngưỡng', 'noun', 'C1', 'Điểm mà tại đó một sự thay đổi bắt đầu xảy ra.', 'She crossed the speaking threshold after one month.', 'Cô ấy vượt qua ngưỡng nói sau một tháng.', NULL, 85),
  ('meticulous', 'tỉ mỉ', 'adjective', 'C2', 'Chú ý đến từng chi tiết nhỏ nhất.', 'His meticulous notes helped the whole group.', 'Những ghi chép tỉ mỉ của cậu ấy giúp cả nhóm.', NULL, 86),
  ('ubiquitous', 'có mặt khắp nơi', 'adjective', 'C2', 'Xuất hiện ở mọi nơi vào cùng một thời điểm.', 'Smartphones are ubiquitous in classrooms now.', 'Điện thoại thông minh giờ có mặt khắp nơi trong lớp học.', NULL, 87),
  ('eloquent', 'hùng biện', 'adjective', 'C2', 'Diễn đạt trôi chảy và có sức thuyết phục.', 'Her eloquent speech moved the whole audience.', 'Bài nói hùng biện của cô ấy làm cả khán phòng xúc động.', NULL, 88),
  ('pragmatic', 'thực dụng', 'adjective', 'C2', 'Tập trung vào điều khả thi thay vì ý tưởng đẹp đẽ.', 'We need a pragmatic plan for the next term.', 'Chúng ta cần một kế hoạch thực dụng cho học kỳ tới.', NULL, 89),
  ('resilient', 'kiên cường', 'adjective', 'C2', 'Vượt qua khó khăn và nhanh chóng phục hồi.', 'Children are often more resilient than adults expect.', 'Trẻ em thường kiên cường hơn người lớn tưởng.', NULL, 90),
  ('alleviate', 'làm dịu', 'verb', 'C2', 'Khiến nỗi đau hoặc vấn đề trở nên nhẹ hơn.', 'Short breaks alleviate eye strain during study.', 'Nghỉ giải lao ngắn giúp giảm mỏi mắt khi học.', NULL, 91),
  ('exacerbate', 'làm trầm trọng thêm', 'verb', 'C2', 'Khiến một vấn đề vốn đã xấu trở nên tệ hơn.', 'Cramming the night before can exacerbate anxiety.', 'Học nhồi tối hôm trước có thể làm tăng thêm sự lo âu.', NULL, 92),
  ('scrutinize', 'xem xét kỹ lưỡng', 'verb', 'C2', 'Kiểm tra rất chi tiết để tìm ra lỗi.', 'Editors scrutinize every sentence before publication.', 'Biên tập viên xem xét kỹ từng câu trước khi xuất bản.', NULL, 93),
  ('hypothesize', 'giả định', 'verb', 'C2', 'Đưa ra điều chưa được chứng minh để tiếp tục nghiên cứu.', 'Researchers hypothesize that sleep improves memory.', 'Các nhà nghiên cứu giả định rằng giấc ngủ cải thiện trí nhớ.', NULL, 94),
  ('speculate', 'suy đoán', 'verb', 'C2', 'Đoán về điều gì khi chưa có đủ thông tin.', 'Commentators speculate about the reasons for the change.', 'Các bình luận viên suy đoán về lý do của sự thay đổi.', NULL, 95),
  ('consensus', 'sự đồng thuận', 'noun', 'C2', 'Ý kiến chung mà cả nhóm cùng chấp nhận.', 'The team reached consensus after a long discussion.', 'Cả nhóm đạt được sự đồng thuận sau một hồi thảo luận dài.', NULL, 96),
  ('dilemma', 'tình thế lưỡng nan', 'noun', 'C2', 'Hoàn cảnh phải chọn giữa hai phương án đều khó.', 'She faced the dilemma of working abroad or staying home.', 'Cô ấy đối mặt tình thế lưỡng nan giữa đi làm nước ngoài hay ở nhà.', NULL, 97),
  ('paradigm', 'hệ hình', 'noun', 'C2', 'Mô hình hoặc cách nhìn nhận chi phối cả một lĩnh vực.', 'The internet changed the paradigm of language learning.', 'Internet đã thay đổi hệ hình của việc học ngôn ngữ.', NULL, 98),
  ('tenacity', 'sự kiên định', 'noun', 'C2', 'Kiên trì giữ mục tiêu dù gặp nhiều trở ngại.', 'Her tenacity turned a weak start into a strong finish.', 'Sự kiên định của cô ấy biến khởi đầu yếu thành kết quả tốt.', NULL, 99),
  ('nostalgia', 'nỗi nhớ quá khứ', 'noun', 'C2', 'Cảm giác ngọt ngào khi nhớ về một thời đã qua.', 'Old songs often fill listeners with nostalgia.', 'Những bài hát cũ thường gợi cho người nghe nỗi nhớ quá khứ.', NULL, 100);

-- ----------------------------------------------------------------------------
-- Video learning
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS video_lessons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(500) NULL,
  topic VARCHAR(100) NOT NULL,
  cefr_level ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2') NOT NULL,
  provider ENUM('youtube', 'file') NOT NULL DEFAULT 'youtube',
  video_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500) NULL,
  duration_seconds SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  xp_reward SMALLINT UNSIGNED NOT NULL DEFAULT 20,
  sort_order SMALLINT UNSIGNED NOT NULL,
  subtitle_en VARCHAR(500) NULL,
  subtitle_vi VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_video_lessons_code (code),
  UNIQUE KEY uq_video_lessons_sort_order (sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS video_vocabulary (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  video_id BIGINT UNSIGNED NOT NULL,
  word VARCHAR(80) NOT NULL,
  ipa VARCHAR(80) NOT NULL,
  meaning_vi VARCHAR(160) NOT NULL,
  detail_vi VARCHAR(500) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_video_vocabulary_word (video_id, word),
  KEY idx_video_vocabulary_video (video_id, sort_order),
  CONSTRAINT fk_video_vocabulary_video FOREIGN KEY (video_id) REFERENCES video_lessons (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS video_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  watched_seconds SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_video_progress_user_video (user_id, video_id),
  KEY idx_video_progress_user (user_id, completed),
  CONSTRAINT fk_video_progress_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_video_progress_video FOREIGN KEY (video_id) REFERENCES video_lessons (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saved_words (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NULL,
  word VARCHAR(80) NOT NULL,
  ipa VARCHAR(80) NULL,
  meaning_vi VARCHAR(160) NULL,
  detail_vi VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saved_words_user_word (user_id, word),
  KEY idx_saved_words_user (user_id, created_at),
  CONSTRAINT fk_saved_words_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_saved_words_video FOREIGN KEY (video_id) REFERENCES video_lessons (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Lesson catalogue
-- ----------------------------------------------------------------------------

INSERT IGNORE INTO video_lessons
  (code, title, description, topic, cefr_level, provider, video_url, thumbnail_url,
   duration_seconds, xp_reward, sort_order, subtitle_en, subtitle_vi)
VALUES
  ('video-small-talk',
   'Chào hỏi tự nhiên như người bản xứ',
   'Học cách mở đầu câu chuyện bằng những cụm từ đệm tự nhiên và luyện shadowing theo từng cụm.',
   'Giao tiếp hằng ngày', 'A2', 'youtube',
   'https://www.youtube.com/watch?v=juKd26qkNAw', NULL,
   1713, 20, 1,
   'Actually, to be completely honest, I had no idea how natural this would feel!',
   'Thực ra mà nói thật lòng, tôi không hề biết cảm giác này lại tự nhiên đến thế!'),
  ('video-cafe-order',
   'Gọi đồ uống tại quán cà phê',
   'Mẫu câu gọi đồ uống lịch sự, kèm cách yêu cầu mức đường và kích cỡ.',
   'Đời sống', 'A1', 'file',
   '/media/videos/cafe-order.mp4', '/media/videos/cafe-order.jpg',
   8, 20, 2,
   'Could I get a large iced coffee with less sugar, please?',
   'Cho tôi một ly cà phê đá lớn với ít đường hơn, làm ơn nhé?'),
  ('video-travel-directions',
   'Hỏi đường khi đi du lịch',
   'Hỏi đường lịch sự tới ga tàu gần nhất và nghe cách người bản xứ chỉ đường.',
   'Du lịch', 'B1', 'file',
   '/media/videos/travel-directions.mp4', '/media/videos/travel-directions.jpg',
   9, 20, 3,
   'Excuse me, could you tell me how to get to the nearest train station?',
   'Xin lỗi, bạn có thể chỉ giúp tôi đường đến ga tàu gần nhất không?');

UPDATE video_lessons SET duration_seconds = 1713 WHERE code = 'video-small-talk';

CREATE TEMPORARY TABLE IF NOT EXISTS seed_video_vocabulary (
  code VARCHAR(64) NOT NULL,
  word VARCHAR(80) NOT NULL,
  ipa VARCHAR(80) NOT NULL,
  meaning_vi VARCHAR(160) NOT NULL,
  detail_vi VARCHAR(500) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO seed_video_vocabulary (code, word, ipa, meaning_vi, detail_vi, sort_order) VALUES
  ('video-small-talk', 'Actually,', '/ˈæk.tʃu.ə.li/', 'Thực ra', 'Từ đệm tự nhiên người bản xứ hay dùng để mở đầu ý kiến.', 1),
  ('video-small-talk', 'to', '/tuː/', 'để', 'Giới từ liên kết mục đích.', 2),
  ('video-small-talk', 'be', '/biː/', 'thì', 'Động từ to be nguyên mẫu.', 3),
  ('video-small-talk', 'completely', '/kəmˈpliːt.li/', 'hoàn toàn', 'Trạng từ nhấn mạnh mức độ triệt để.', 4),
  ('video-small-talk', 'honest,', '/ˈɒn.ɪst/', 'thành thật', 'Cụm “to be honest” = thành thật mà nói.', 5),
  ('video-small-talk', 'I', '/aɪ/', 'tôi', 'Đại từ chủ ngữ ngôi thứ nhất.', 6),
  ('video-small-talk', 'had', '/hæd/', 'đã', 'Quá khứ đơn của have.', 7),
  ('video-small-talk', 'no', '/nəʊ/', 'không', 'Từ phủ định.', 8),
  ('video-small-talk', 'idea', '/aɪˈdɪə/', 'biết', '“have no idea” = hoàn toàn không hề biết trước.', 9),
  ('video-small-talk', 'how', '/haʊ/', 'thế nào', 'Liên từ chỉ phương thức.', 10),
  ('video-small-talk', 'natural', '/ˈnætʃ.ər.əl/', 'tự nhiên', 'Tính từ: trôi chảy, không gượng gạo.', 11),
  ('video-small-talk', 'this', '/ðɪs/', 'điều này', 'Đại từ chỉ định.', 12),
  ('video-small-talk', 'would', '/wʊd/', 'sẽ', 'Trợ động từ chỉ khả năng.', 13),
  ('video-small-talk', 'feel!', '/fiːl/', 'cảm nhận!', 'Động từ: mang lại cảm giác.', 14),

  ('video-cafe-order', 'Could', '/kʊd/', 'có thể', 'Modal xin phép lịch sự: Could I get…?', 1),
  ('video-cafe-order', 'large', '/lɑːdʒ/', 'lớn', 'Kích cỡ đồ uống lớn hơn bình thường.', 2),
  ('video-cafe-order', 'iced', '/aɪst/', 'đá lạnh', 'Tính từ chỉ đồ uống có đá.', 3),
  ('video-cafe-order', 'coffee', '/ˈkɒf.i/', 'cà phê', 'Đồ uống phổ biến, ở đây là cà phê đá.', 4),
  ('video-cafe-order', 'less', '/les/', 'ít hơn', 'So sánh hơn của little: less sugar = ít đường hơn.', 5),
  ('video-cafe-order', 'sugar', '/ˈʃʊɡ.ər/', 'đường', 'Chất tạo vị ngọt dùng trong đồ uống.', 6),
  ('video-cafe-order', 'please?', '/pliːz/', 'làm ơn nhé?', 'Từ thêm vào cuối câu để tăng tính lịch sự.', 7),

  ('video-travel-directions', 'Excuse', '/ɪkˈskjuːz/', 'xin lỗi', '“Excuse me” dùng để mở lời với người lạ.', 1),
  ('video-travel-directions', 'me,', '/miː/', 'tôi', 'Tân ngữ của “excuse me”.', 2),
  ('video-travel-directions', 'could', '/kʊd/', 'có thể', 'Modal lịch sự khi nhờ ai đó giúp.', 3),
  ('video-travel-directions', 'tell', '/tel/', 'chỉ giúp', 'Tell me how = nói cho tôi biết làm thế nào.', 4),
  ('video-travel-directions', 'get', '/ɡet/', 'đi đến', '“get to” = đến được một địa điểm.', 5),
  ('video-travel-directions', 'nearest', '/ˈnɪə.rɪst/', 'gần nhất', 'So sánh nhất của near.', 6),
  ('video-travel-directions', 'train', '/treɪn/', 'tàu hỏa', 'Phương tiện di chuyển đường sắt.', 7),
  ('video-travel-directions', 'station?', '/ˈsteɪ.ʃən/', 'ga', 'Nơi tàu dừng để đón và trả khách.', 8);

INSERT IGNORE INTO video_vocabulary (video_id, word, ipa, meaning_vi, detail_vi, sort_order)
SELECT v.id, s.word, s.ipa, s.meaning_vi, s.detail_vi, s.sort_order
FROM seed_video_vocabulary s
JOIN video_lessons v ON v.code = s.code;

DROP TEMPORARY TABLE IF EXISTS seed_video_vocabulary;
