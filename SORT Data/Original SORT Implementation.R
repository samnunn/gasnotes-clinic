
# This is the server logic for a Shiny web application.
# You can find out more about building applications with Shiny here:
#
# http://shiny.rstudio.com
#

library(shiny)
library(tidyverse)
library(DT)
library(scales)
library(waffle)

procedures <- read.csv("SNAP2_procedurelist.csv", stringsAsFactors = FALSE)
risk_distrib <- read.csv("SNAP2_riskdistribution.csv", stringsAsFactors = FALSE)
percentile_morb <- ecdf(risk_distrib$SORT_morb_risk)
percentile_mort <- ecdf(risk_distrib$SORT_mort_risk)

shinyServer(function(input, output) {
  
  out_tab <- eventReactive(input$Compute, {
    
    procedures %>% filter(SurgeryProcedure %in% input$Procedure) %>%
      select(SurgeryProcedure, SurgeryProcedureSeverity) %>%
      mutate(ASA = input$ASA) %>%
      mutate(Urgency = input$Urgency) %>%
      mutate(Specialty = input$Specialty) %>%
      mutate(Malignancy = input$Malignancy) %>%
      mutate(Age = input$Age) %>%
      mutate(Clinical = input$Clinical) %>%
      mutate(SORT_morb_logit = ((ASA == "2") * 0.332 +
                                  (ASA == "3") * 1.140 + 
                                  (ASA == "4") * 1.223 +
                                  (ASA == "5") * 1.223 +
                                  (Specialty == "Colorectal") * 1.658 +
                                  (Specialty == "UpperGI") * -0.929 +
                                  (Specialty == "Vascular") * 0.296 +
                                  (Specialty == "Bariatric") * -1.065 +
                                  (!(Specialty %in% c("Colorectal", "UpperGI", "Vascular", "Bariatric", "Orthopaedic"))) * 0.181 +
                                  (SurgeryProcedureSeverity == "Xma") * 1.238 + 
                                  (SurgeryProcedureSeverity == "Com") * 1.238 +
                                  (Malignancy == "Yes") * 0.897 + 
                                  (Age == "65-79") * 0.118 + 
                                  (Age == ">80") * 0.550 -
                                  3.228)) %>%
      mutate(SORT_mort_logit = ((ASA == "3") * 1.411 +
                                  (ASA == "4") * 2.388 +
                                  (ASA == "5") * 4.081 +
                                  (Urgency == "Expedited") * 1.236 +
                                  (Urgency == "Urgent") * 1.657 +
                                  (Urgency == "Immediate") * 2.452 +
                                  (Specialty %in% c("Colorectal", "UpperGI", "Bariatric", "HPB", "Thoracic", "Vascular")) * 0.712 +
                                  (SurgeryProcedureSeverity %in% c("Xma", "Com")) * 0.381 +
                                  (Malignancy == "Yes") * 0.667 +
                                  (Age == "65-79") * 0.777 +
                                  (Age == ">80") * 1.591 -
                                  7.366)) %>%
      mutate(POMS_Risk = arm::invlogit(SORT_morb_logit)) %>%
      mutate(Low_grade = arm::invlogit(SORT_morb_logit * 1.008 - 0.316)) %>%
      mutate(High_grade = arm::invlogit(SORT_morb_logit * 0.827 - 0.874)) %>%
      mutate(Day14 = arm::invlogit(SORT_morb_logit * 0.894 - 1.478)) %>%
      mutate(Day21 = arm::invlogit(SORT_morb_logit * 1.081 - 2.327)) %>%
      mutate(Day28 = arm::invlogit(SORT_morb_logit * 1.048 - 2.770)) %>%
      mutate(SORT_mortality = arm::invlogit(SORT_mort_logit)) %>%
      mutate(Combined_pred = ifelse(Clinical == "Don't know", NA, 
                                    arm::invlogit(0.04028 * (SORT_mortality * 100) + 
                                                    1.487 * (Clinical == "1-2.5%") + 
                                                    2.365 * (Clinical == "2.6-5%") + 
                                                    3.074 * (Clinical == "5.1-10%") + 
                                                    4.156 * (Clinical == "10.1-50%") + 
                                                    5.028 * (Clinical == ">50%") -
                                                    6.403))) %>%
      select(POMS_Risk:Combined_pred) %>%
      rename(`D7 POMS` = "POMS_Risk",
             `D7 Low-grade POMS` = "Low_grade",
             `D7 High-grade POMS` = "High_grade",
             `D14 POMS` = "Day14",
             `D21 POMS` = "Day21",
             `D28 POMS` = "Day28",
             `D30 Mortality (SORT)` = "SORT_mortality",
             `D30 Mortality (Subjective assessment adjusted)` = "Combined_pred")
    
  })

  output$Table <- renderDT({
    
    risks <- out_tab() %>%
      gather(key = "Outcome", value = "Risk") %>%
      datatable(options = list(dom = 't'), rownames = FALSE) %>% 
      formatPercentage(digits = 2,
                       c("Risk"))
    
  })
  
  output$MorbGraph <- renderPlot({
    
    ggplot(risk_distrib, aes(x = SORT_morb_risk)) +
      geom_density(adjust = 5, size = 1, col = "skyblue", fill = "skyblue") +
      labs(title = "D7 POMS morbidity",
           x = "Risk", 
           y = "Probability Density") +
      theme_minimal() +
      geom_vline(data = as.data.frame(out_tab()), aes(xintercept = `D7 POMS`)) +
      geom_label(data = as.data.frame(out_tab()), 
                 aes(x = `D7 POMS`, y = -0.1, label = 
                       paste0(round(percentile_morb(`D7 POMS`)*100, 1), " centile"))) +
      scale_x_continuous(labels = percent)
    
  })
  
  output$MorbWaffle <- renderPlot({
    
    patients_POMS <- round(as.data.frame(out_tab())$`D7 POMS` * 1000)
    
    waffle(c("Morbidity" = patients_POMS, 
             "No morbidity" = 1000 - patients_POMS),
           rows = 25,
           size = 1,
           glyph_size = 16,
           colors = c("#fc8d62", "#66c2a5"), 
           title = "D7 POMS morbidity",
           legend_pos = "bottom") +
      labs(subtitle = "Each box represents one person.\nThere are 1,000 people represented in this plot.")
    
  })
  
  output$MortGraph <- renderPlot({
    
    ggplot(risk_distrib, aes(x = SORT_mort_risk)) +
      geom_density(adjust = 5, size = 1, col = "skyblue", fill = "skyblue") +
      labs(title = "D30 Mortality complications",
           x = "Risk", 
           y = "Probability Density") +
      theme_minimal() +
      geom_vline(data = as.data.frame(out_tab()), aes(xintercept = `D30 Mortality (SORT)`)) +
      geom_label(data = as.data.frame(out_tab()), 
                 aes(x = `D30 Mortality (SORT)`, y = -0.1, label = 
                       paste0(round(percentile_mort(`D30 Mortality (SORT)`)*100, 1), " centile"))) +
      scale_x_continuous(labels = percent)
    
  })
  
  output$MortWaffle <- renderPlot({
    
    patients_mort <- round(as.data.frame(out_tab())$`D30 Mortality (SORT)` * 1000)
    
    waffle(c("Deaths" = patients_mort, 
             "Survivors" = 1000 - patients_mort),
           rows = 25,
           size = 1,
           glyph_size = 16,
           colors = c("#fc8d62", "#66c2a5"), 
           title = "D30 Mortality",
           legend_pos = "bottom") +
      labs(subtitle = "Each box represents one person.\nThere are 1,000 people represented in this plot.")
    
  })
  
  output$CombinedMortWaffle <- renderPlot({
    
    patients_mort <- round(as.data.frame(out_tab())$`D30 Mortality (Subjective assessment adjusted)` * 1000)
    
    waffle(c("Deaths" = patients_mort, 
             "Survivors" = 1000 - patients_mort),
           rows = 25,
           size = 1,
           glyph_size = 16,
           colors = c("#fc8d62", "#66c2a5"), 
           title = "D30 Mortality (Subjective assessment adjusted)",
           legend_pos = "bottom") +
      labs(subtitle = "Each box represents one person.\nThere are 1,000 people represented in this plot.")
    
  })

})
