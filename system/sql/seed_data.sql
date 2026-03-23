-- סקריפט למילוי נתונים פיקטיביים (3 חודשים אחורה ו-3 חודשים קדימה)
DO $$
DECLARE
    i INT;
    v_owner_names TEXT[] := ARRAY['יוסי כהן', 'שרה לוי', 'דני רובס', 'מיכל אברהם', 'רון שחר', 'גלית יצחק', 'אבי ביטון', 'נועה קירל', 'עומר אדם', 'עידן רייכל', 'רוני סופר', 'רחל המשוררת'];
    -- Fixed phone numbers for each owner to ensure multiple bookings per client
    v_owner_phones TEXT[] := ARRAY['0501111111', '0522222222', '0543333333', '0504444444', '0525555555', '0546666666', '0507777777', '0528888888', '0549999999', '0501234567', '0527654321', '0545554443'];
    
    v_dog_names TEXT[] := ARRAY['רקס', 'לאסי', 'בל', 'סימבה', 'נלה', 'צ׳ארלי', 'לוקה', 'מקס', 'ביילי', 'לונה', 'רוקי', 'טופי', 'שוקו', 'לאקי', 'ג׳וני'];
    v_dog_breeds TEXT[] := ARRAY['קטן', 'בינוני', 'גדול'];
    v_dog_ages TEXT[] := ARRAY['גור (עד שנה)', 'צעיר (1-3)', 'בוגר (4-7)', 'מבוגר (8+)'];
    v_dog_temperaments TEXT[] := ARRAY['ידידותי', 'חששן', 'אנרגטי', 'רגוע', 'תוקפני לזכרים', 'אוהב לשחק', 'נובח הרבה', 'פחדן'];
    
    v_idx INT;
    v_random_owner TEXT;
    v_random_dog TEXT;
    v_random_breed TEXT;
    v_random_phone TEXT;
    v_check_in DATE;
    v_check_out DATE;
    v_status TEXT;
    v_is_arrived BOOLEAN;
    v_is_departed BOOLEAN;
    v_created_at TIMESTAMPTZ;
    v_price_to_save INT;
BEGIN
    -- יצירת 150 הזמנות אקראיות
    FOR i IN 1..150 LOOP
        -- Choose a random owner index
        v_idx := 1 + floor(random() * array_length(v_owner_names, 1));
        
        -- Get consistency between owner and phone
        v_random_owner := v_owner_names[v_idx];
        v_random_phone := v_owner_phones[v_idx];
        
        -- Assign discounted prices for repeat customers based on their index
        -- Owners 1-4: 100 NIS (Loyal), Owners 5-8: 110 NIS (Silver), others 130 (Standard)
        IF v_idx <= 4 THEN
            v_price_to_save := 100;
        ELSIF v_idx <= 8 THEN
            v_price_to_save := 115;
        ELSE
            v_price_to_save := 130;
        END IF;

        -- Each owner has 1 or 2 specific dogs (for consistent history)
        v_random_dog := v_dog_names[((v_idx + floor(random() * 2)::int) % array_length(v_dog_names, 1)) + 1];
        
        v_random_breed := v_dog_breeds[1 + floor(random() * array_length(v_dog_breeds, 1))::int];
        
        -- תאריך אקראי: בין 90 יום אחורה ל-90 יום קדימה
        v_check_in := CURRENT_DATE + (floor(random() * 180) - 90)::INT;
        -- משך שהייה: 1 עד 10 ימים
        v_check_out := v_check_in + (floor(random() * 10) + 1)::INT;
        
        -- קביעת סטטוס ולוגיקה עסקית
        IF v_check_out < CURRENT_DATE THEN
            -- הזמנות עבר
            IF random() < 0.15 THEN
                v_status := 'בוטל';
                v_is_arrived := FALSE;
                v_is_departed := FALSE;
            ELSE
                v_status := 'מאושר';
                v_is_arrived := TRUE;
                v_is_departed := TRUE;
            END IF;
        ELSE
            -- הזמנות עתיד או הווה
            IF random() < 0.2 THEN
                v_status := 'ממתין';
            ELSIF random() < 0.1 THEN
                v_status := 'בוטל';
            ELSE
                v_status := 'מאושר';
            END IF;
            
            v_is_arrived := FALSE;
            v_is_departed := FALSE;
            
            -- טיפול בהזמנות שקורות ממש עכשיו (נכנסו אבל לא יצאו)
            IF v_status = 'מאושר' AND v_check_in <= CURRENT_DATE THEN
                 v_is_arrived := TRUE;
            END IF;
        END IF;

        -- תאריך יצירת ההזמנה (קצת לפני הצ'ק אין)
        v_created_at := v_check_in - (floor(random() * 20) + 1)::INT;

        INSERT INTO orders (
            created_at,
            owner_name,
            phone,
            check_in,
            check_out,
            dog_name,
            dog_age,
            dog_breed,
            neutered,
            notes,
            status,
            price_per_day,
            is_arrived,
            is_departed,
            user_id,
            admin_note
        ) VALUES (
            v_created_at,
            v_random_owner,
            v_random_phone,
            v_check_in,
            v_check_out,
            v_random_dog,
            v_dog_ages[1 + floor(random() * array_length(v_dog_ages, 1))::int],
            v_random_breed,
            CASE WHEN random() > 0.5 THEN 'מסורס' ELSE 'לא מסורס' END,
            CASE WHEN random() < 0.2 THEN 'לקוח ביקש אוכל מיוחד' WHEN random() < 0.4 THEN 'להתקשר לפני הגעה' ELSE '' END,
            v_status,
            v_price_to_save,
            v_is_arrived,
            v_is_departed,
            '9f28eb3a-6f4b-414d-b593-0d64125cbc88', -- PENSION_OWNER_ID המוגדר בקוד
            'DEMO_DATA'
        );
    END LOOP;
END $$;
