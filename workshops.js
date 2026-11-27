// Each workshop connects a business decision to the lessons and evidence needed to explain it.
const workshops = [
  {
    module:'Fundamentals', title:'Find the right record', role:'New planner',
    situation:'Two planners search for the same work order. One sees it and the other sees an empty list. Before asking for broader access, establish what each search actually included.',
    choices:[['L008','Inspect the saved filter','Record the organization, status and date criteria. Re-run with one criterion changed at a time so you can identify which condition excludes the record.'],['L002','Verify the identity','Compare the record identifier and organization. A matching description alone cannot establish that both users opened the same work order.'],['L001','Record the reference','Check the procedure in the guide for the installed release. Save the heading and page with the test result.']],
    check:'Both users now see a record with the same description. What evidence would establish that it is the same record?',answer:'Compare the identifier and organization, then reproduce the search with the same criteria and role. Record any difference that survives that comparison.',sql:'L135'
  },
  {
    module:'Equipment management',title:'Trace a replacement asset',role:'Reliability engineer',
    situation:'A replacement pump takes over the same duty in Utilities. The planner needs the new unit’s history to remain distinguishable from the removed unit’s history.',
    choices:[['L012','Identify the physical unit','Compare asset code, serial identity and organization before entering the replacement. Keep the historical unit identifiable.'],['L013','Identify the duty position','Determine whether a configured position represents the duty the replacement fills. Trace the physical asset and its position separately.'],['L020','Verify the hierarchy','Review the parent relationship and effective record in the equipment hierarchy. Check that a search for the old unit still finds its history.']],
    check:'A report grouped only by position shows two repairs. Can it assign both repairs to the replacement?',answer:'The position identifies a duty. Trace each repair to the recorded physical asset and the relevant date before attributing it to a unit.',sql:'L128'
  },
  {
    module:'Materials and inventory',title:'Explain a stock shortage',role:'Storekeeper',
    situation:'MAIN has three seals on hand. One is reserved for a pump job. REMOTE holds another eight. The planner asks whether MAIN can immediately supply three unreserved seals.',
    choices:[['L037','Choose the store record','Use the part and store together. Combining MAIN and REMOTE would conceal a local shortage.'],['L046','Account for reservations','Subtract MAIN reservations from MAIN stock. In this training snapshot three on hand minus one reserved leaves two available.'],['L041','Check the transfer option','If another store can supply stock, review its availability and the transfer procedure. Confirm receipt before counting a transfer as available at the destination.']],
    check:'What happens if a report joins reservations to stock by part alone?',answer:'The MAIN reservation can be subtracted from REMOTE as well. Aggregate reservations by part and store, then join using both columns.',sql:'L132'
  },
  {
    module:'Purchasing management',title:'Reconcile a partial receipt',role:'Buyer',
    situation:'Purchase order 301 has one training line for five seals. A receipt records three. The buyer needs the remaining quantity before arranging another delivery.',
    choices:[['L053','Confirm the order line','Find the part, unit, ordered quantity and line number. A purchase-order header alone cannot identify the quantity being reconciled.'],['L154','Match the receipt','Match the receipt on order and line, then compare units. Multiple receipts for the line need to be added before calculating the balance.'],['L143','Test the balance','Reconcile ordered, received and outstanding quantities. In the training data 5 minus 3 leaves 2 outstanding.']],
    check:'A second receipt of two arrives on the same line. Which values change?',answer:'The ordered quantity remains five. Total received becomes five and outstanding becomes zero. Summing the order quantity after joining both receipt rows would double it.',sql:'L133'
  },
  {
    module:'Work management',title:'Reconcile labor before closeout',role:'Maintenance supervisor',
    situation:'Work order 101 includes mechanical activity 10 and electrical activity 20. The supervisor needs to explain the actual hours on each activity before closeout.',
    choices:[['L068','Read the activity plan','Identify activities by work order and activity number together. Activity 10 also exists on other work orders.'],['L152','Review the bookings','Compare each time entry with its activity, employee and hours. In the training data these two activities carry two hours and one hour respectively.'],['L153','Check closeout evidence','Review the actual work and outstanding requirements. Keep unexplained differences visible for follow-up.']],
    check:'Why does grouping by activity number alone produce an unreliable result?',answer:'Different work orders reuse the same activity numbers. Match and group on the order and the activity together, retaining activities without bookings when reviewing the plan.',sql:'L130'
  },
  {
    module:'Preventive maintenance',title:'Investigate a missing PM order',role:'Maintenance planner',
    situation:'PUMP30 is configured with a 30-day interval. The expected pump order is absent from the planner’s list.',
    choices:[['L082','Read the schedule','Confirm interval, unit and generation criteria for the schedule. The interval by itself does not establish that an order is due today.'],['L084','Check the equipment association','Verify the pump, organization and first due information on the equipment association.'],['L085','Inspect existing orders','Check work orders linked to the schedule and their statuses. Resolve a visibility or eligibility problem before repeating a generation run.']],
    check:'Can a matching pump code and a nearby date prove an order came from PUMP30?',answer:'They identify a possible match. Verify the explicit schedule association in the source application. The small training work-order table omits that association.',sql:'L127'
  },
  {
    module:'Inspection, safety and calibration',title:'Investigate an inspection finding',role:'Inspection coordinator',
    situation:'An inspection flags a pump for review. The coordinator needs to show where the observation was made and what evidence supports follow-up.',
    choices:[['L098','Identify the inspection point','Review the equipment and aspect point. Measurements from different points may require different interpretations.'],['L094','Capture the observation','Retain the observation, date and relevant context so a reviewer can distinguish a new finding from a repeated one.'],['L093','Trace the follow-up','Connect the finding to its nonconformity record where applicable and verify responsibility and current status.']],
    check:'Does a second observation automatically establish deterioration?',answer:'Compare the point, measurement method, unit, timing and acceptance criteria before interpreting a trend. Preserve the original observations.',sql:null
  },
  {
    module:'Specialized modules',title:'Explain shutdown project costs',role:'Shutdown coordinator',
    situation:'Two departments book work during a shutdown. A project report needs to explain which costs belong to the shutdown and which were routine maintenance.',
    choices:[['L103','Define the reporting scope','Identify the project and budget codes used for the shutdown. Record the reporting window and ownership.'],['L104','Trace included work','Check each work order’s project association before including it. A shared date or department does not establish project membership.'],['L077','Reconcile actuals','Trace a sample reported amount back to the work order cost review. Compare totals at the same level of detail.']],
    check:'What evidence would justify including a pump repair dated during the shutdown?',answer:'A documented association with the shutdown project and traceable cost records within the agreed reporting scope.',sql:'L129'
  },
  {
    module:'Administration',title:'Diagnose a missing approval action',role:'EAM administrator',
    situation:'A planner can read a work request but cannot perform the expected approval. Reproduce the exact user, organization, record and current status.',
    choices:[['L117','Verify organization membership','Confirm the test user belongs to the required organization and that the record belongs to that scope.'],['L118','Review group membership','Identify the assigned group and the permissions relevant to the screen. Separate read visibility from authority to change status.'],['L119','Verify the transition','Check the intended starting and ending statuses and the authorization configured for that transition. Test the smallest relevant configuration change in training.']],
    check:'Another user can approve a different request. Does that isolate the cause?',answer:'No. Compare the same record, organization and transition using controlled test roles so that only the permission under examination changes.',sql:'L135'
  },
  {
    module:'Customization and integration',title:'Trace a missing downstream field',role:'Integration analyst',
    situation:'A field appears on an EAM record but is empty in a downstream report. Trace one known record across the integration boundary.',
    choices:[['L126','Check field selection','Record the source value and verify that the selected dataset includes the intended field.'],['L123','Inspect an exported sample','Use one known identifier to compare source, extract and destination. Capture the first stage where the value changes or disappears.'],['L146','Design a repeatable test','Repeat with an empty and a populated value. Verify field mapping, type, timing and the intended handling of updates.']],
    check:'The source screen shows today’s value; the extract is from yesterday. What should you compare first?',answer:'Align the record identity and extraction time. A difference between snapshots can explain the mismatch even when field mapping is correct.',sql:null
  },
  {
    module:'Database and SQL',title:'Find a duplicate introduced by a join',role:'Reporting analyst',
    situation:'A report counts two open pump orders. The work-order list shows only one. Trace the grain of each intermediate result.',
    choices:[['L127','Count the source orders','Filter open work orders and list the individual IDs. Keep this list as your control.'],['L130','Inspect the one-to-many relationship','Join activities and inspect the order ID on each row. Order 101 repeats once per activity.'],['L129','Choose the right aggregation','Count orders before joining detail, or count distinct order IDs when detail is required. Reconcile the grouped output with the original list.']],
    check:'Would SUM(DISTINCT cost) reliably fix an inflated cost total?',answer:'No. Two separate orders can have the same cost. Aggregate or deduplicate using the order identity before adding the amounts.',sql:'L130'
  },
  {
    module:'Implementation and troubleshooting',title:'Define a repeatable acceptance test',role:'Implementation consultant',
    situation:'The business asks whether procurement is ready for go-live. A successful screen demonstration leaves reconciliation and exceptions untested.',
    choices:[['L137','Define the acceptance condition','Agree on the role, starting records, expected outcome and owner who will sign off.'],['L143','Exercise the partial receipt','Test one order line with a partial receipt, then complete it. Capture ordered, received and outstanding amounts at each stage.'],['L147','Preserve evidence','Record configuration, identifiers, inputs and observed outcomes. Retest the same case after a fix using a known starting state.']],
    check:'The receipt saved successfully. What else must pass before this scenario is accepted?',answer:'The right line must show the correct cumulative quantity and outstanding balance, and the business owner must be able to reproduce and verify the result.',sql:'L133'
  }
];

const sqlResults = {"L127": {"columns": ["EVT_CODE", "EVT_OBJECT", "EVT_STATUS"], "rows": [[101, "PUMP-001", "Open"], [103, "COMP-001", "Open"]]}, "L128": {"columns": ["EVT_CODE", "OBJ_DESC", "EVT_STATUS"], "rows": [[101, "Cooling water pump", "Open"], [102, "Drive motor", "Closed"], [103, "Air compressor", "Open"], [104, "Cooling water pump", "Closed"], [105, "Control valve", "Closed"]]}, "L129": {"columns": ["EVT_OBJECT", "work_count", "total"], "rows": [["COMP-001", 1, 300.0], ["MOTOR-001", 1, 750.0], ["PUMP-001", 2, 1050.0], ["VALVE-001", 1, 100.0]]}, "L130": {"columns": ["ACT_EVENT", "ACT_ACT", "ACT_EST", "actual"], "rows": [[101, 10, 2.0, 2.0], [101, 20, 1.0, 1.0], [102, 10, 4.0, 5.0], [104, 10, 3.0, 4.0]]}, "L131": {"columns": ["STO_PART", "STO_STORE", "STO_QTY", "STO_ORDLEV", "gap"], "rows": [["FILTER", "MAIN", 2, 6, 4], ["SEAL", "MAIN", 3, 5, 2]]}, "L132": {"columns": ["STO_PART", "STO_STORE", "STO_QTY", "reserved", "available"], "rows": [["BEARING", "MAIN", 12, 0, 12], ["FILTER", "MAIN", 2, 1, 1], ["SEAL", "MAIN", 3, 1, 2], ["SEAL", "REMOTE", 8, 0, 8]]}, "L133": {"columns": ["ORL_ORDER", "ORL_ORDLINE", "ORL_ORDQTY", "received", "outstanding"], "rows": [[301, 1, 5, 3, 2], [302, 1, 10, 10, 0]]}, "L134": {"columns": ["REA_METER", "REA_DATE", "REA_READING", "delta"], "rows": [["HOUR-C", "2026-01-01", 1000.0, null], ["HOUR-C", "2026-02-01", 1250.0, 250.0], ["HOUR-C", "2026-03-01", 1500.0, 250.0]]}, "L135": {"columns": ["REQ_CODE", "ORG_DESC", "REQ_STATUS"], "rows": [[201, "Manufacturing plant", "Approved"]]}, "L136": {"columns": ["name", "sql"], "rows": [["R5ACTIVITIES", "CREATE TABLE R5ACTIVITIES(ACT_EVENT INTEGER REFERENCES R5EVENTS(EVT_CODE), ACT_ACT INTEGER, ACT_TRADE TEXT REFERENCES R5TRADES(TRD_CODE), ACT_EST REAL, PRIMARY KEY(ACT_EVENT, ACT_ACT))"]]}};
