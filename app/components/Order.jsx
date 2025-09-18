import {
  IndexTable,
  LegacyCard,
  IndexFilters,
  useSetIndexFiltersMode,
  Text,
  Badge,
  useBreakpoints,
  Box,
  Button,
  Modal,
  RadioButton,
  Icon,
  Page,
  BlockStack,
  DatePicker,
  InlineError,
  Toast,
  Select,
  Frame,
  InlineGrid,
  InlineStack,
  Spinner,
} from '@shopify/polaris';
import { OrderIcon } from '@shopify/polaris-icons';
import { useState, useCallback, useMemo, useEffect } from 'react';

function OrderManagement({ orders }) {
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;
  const [itemStrings] = useState(['All']);
  const [toastActive, setToastActive] = useState(false);
  const [selected, setSelected] = useState(0);
  const [sortSelected, setSortSelected] = useState(['order asc']);
  const { mode, setMode } = useSetIndexFiltersMode();
  const [selectedDates, setSelectedDates] = useState({ start: new Date(), end: new Date() });
  const [{ month, year }, setDate] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [queryValue, setQueryValue] = useState('');
  const [selectedResources, setSelectedResources] = useState([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportOption, setExportOption] = useState('');
  const [timeError, setTimeError] = useState(false);
  const [startHour, setStartHour] = useState('00');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('23');
  const [endMinute, setEndMinute] = useState('59');
  const onHandleCancel = () => { };
  const toastMarkup = toastActive ? (
    <Frame>
      <Toast content="No orders match the selected filters and date range." onDismiss={() => setToastActive(false)} />
    </Frame>
  ) : null;
  
  const viewTabs = useMemo(() => itemStrings.map((item, index) => ({
    content: item,
    index,
    id: `${item}-${index}`,
    isLocked: index === 0,
  })), [itemStrings]);
useEffect(() => {
  if (orders && orders.length > 0) {
    setLoading(false);
  } else {
    setLoading(true);
  }
}, [orders]);
  const sortOptions = [
    { label: 'Order', value: 'order asc', directionLabel: 'Ascending' },
    { label: 'Order', value: 'order desc', directionLabel: 'Descending' },
    { label: 'Customer', value: 'customer asc', directionLabel: 'A-Z' },
    { label: 'Customer', value: 'customer desc', directionLabel: 'Z-A' },
    { label: 'Date', value: 'date asc', directionLabel: 'Oldest first' },
    { label: 'Date', value: 'date desc', directionLabel: 'Newest first' },
    { label: 'Total', value: 'total asc', directionLabel: 'Ascending' },
    { label: 'Total', value: 'total desc', directionLabel: 'Descending' },
  ];

  // Filtering
  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (queryValue) {
      const lowerQuery = queryValue.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(lowerQuery) ||
          o.customer.toLowerCase().includes(lowerQuery)
      );
    }
    return result;
  }, [orders, queryValue]);

  // Pagination
  const paginatedOrdersRaw = useMemo(
    () => filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredOrders, currentPage]
  );

  // Sorting
  const paginatedOrders = useMemo(() => {
    const [sortKey, sortDirection] = sortSelected[0].split(" ");
    let result = [...paginatedOrdersRaw];
    result.sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case "order":
          va = parseInt(b.id.replace("gid://shopify/Order/", ""), 10);
          vb = parseInt(a.id.replace("gid://shopify/Order/", ""), 10);
          break;
        case "customer":
          va = a.customer.toLowerCase();
          vb = b.customer.toLowerCase();
          break;
        case "date":
          va = parseOrderDate(a.date).getTime();
          vb = parseOrderDate(b.date).getTime();
          break;
        case "total":
          va = parseFloat(String(a.total).replace("$", "")) || 0;
          vb = parseFloat(String(b.total).replace("$", "")) || 0;
          break;
        default:
          return 0;
      }
      if (va < vb) return sortDirection === "asc" ? -1 : 1;
      if (va > vb) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [paginatedOrdersRaw, sortSelected]);

  const handleMonthChange = useCallback((month, year) => setDate({ month, year }), []);
  const handleSelectionChange = useCallback((selectionType, toggleType, selection) => {
    if (selectionType === 'single') {
      setSelectedResources((prev) =>
        toggleType
          ? [...new Set([...prev, selection])]
          : prev.filter((id) => id !== selection)
      );
    } else if (selectionType === 'page') {
      const pageIds = paginatedOrders.map((o) => o.id);
      setSelectedResources((prev) =>
        toggleType
          ? [...new Set([...prev, ...pageIds])]
          : prev.filter((id) => !pageIds.includes(id))
      );
    } else if (selectionType === 'multi' && selection) {
      const { start, end } = selection;
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      const rangeIds = paginatedOrders.slice(min, max + 1).map((o) => o.id);
      setSelectedResources((prev) =>
        toggleType
          ? [...new Set([...prev, ...rangeIds])]
          : prev.filter((id) => !rangeIds.includes(id))
      );
    }
  }, [paginatedOrders]);

  const allResourcesSelected = paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedResources.includes(o.id));

  // Export Handler
  const handleExport = useCallback(async (selectedOrders = filteredOrders) => {
    const now = new Date();
    let startTime, endTime;
    setTimeError(false);

    if (exportOption === 'dateRange' && selectedDates.start && selectedDates.end) {
      startTime = new Date(selectedDates.start);
      endTime = new Date(selectedDates.end);
      endTime.setHours(23, 59, 59, 999);
    } else if (exportOption === 'timeRange') {
      const startHh = parseInt(startHour);
      const startMm = parseInt(startMinute);
      const endHh = parseInt(endHour);
      const endMm = parseInt(endMinute);
      const startTotal = startHh * 60 + startMm;
      const endTotal = endHh * 60 + endMm;
      if (endTotal <= startTotal) {
        setTimeError(true);
        return;
      }
      startTime = new Date(selectedDate);
      startTime.setHours(startHh, startMm, 0, 0);
      endTime = new Date(selectedDate);
      endTime.setHours(endHh, endMm, 0, 0);
    } else {
      startTime = new Date(0);
      endTime = now;
    }

    const ordersToExport = selectedOrders.filter((order) => {
      const orderDate = parseOrderDate(order.date);
      return orderDate >= startTime && orderDate <= endTime;
    });

    if (ordersToExport.length === 0) {
      setToastActive(true);
      setExportModalOpen(false);
      return;
    }

    try {
      const res = await fetch("/app/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orders: ordersToExport,
          filters: { exportOption, startTime, endTime }
        }),
      });

      const data = await res.json();
      if (data.success) {
        const link = document.createElement("a");
        link.href = data.filePath;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        console.error("Export failed", data.error);
        setToastActive(true);
      }
    } catch (err) {
      console.error("Error hitting export API", err);
      setToastActive(true);
    }

    setExportModalOpen(false);
  }, [
    exportOption,
    selectedDate,
    selectedDates,
    startHour,
    startMinute,
    endHour,
    endMinute,
    filteredOrders,
  ]);

  // Bulk Actions
  const promotedBulkActions = [
    {
      title: 'Export',
      actions: [
        {
          content: 'Export as CSV',
          onAction: () => {
            const selectedOrders = filteredOrders.filter((order) =>
              selectedResources.includes(order.id)
            );
            handleExport(selectedOrders);
          }
        },
      ],
    },
  ];

  // Time Options
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    label: i.toString().padStart(2, '0'),
    value: i.toString().padStart(2, '0'),
  }));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => ({
    label: i.toString().padStart(2, '0'),
    value: i.toString().padStart(2, '0'),
  }));

  // Pagination Label
  const startIdx = filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, filteredOrders.length);
  const paginationLabel = `${startIdx} - ${endIdx} of ${filteredOrders.length}`;

  // Table Rows
  const breakpoints = useBreakpoints();
  const condensed = breakpoints.smDown;
  const rowMarkup = paginatedOrders.map(
    (
      {
        id,
        orderNumber,
        date,
        customer,
        total,
        paymentStatus,
        paymentProgress,
        fulfillmentStatus,
        fulfillmentProgress,
        deliveryMethod,
        channels,
        items,
        tags,
        refunds,
        properties
      },
      index,
    ) => (
      <IndexTable.Row id={id} key={id} selected={selectedResources.includes(id)} position={index}>
        {condensed ? (
          <div style={{ padding: '12px 16px', width: '100%' }}>
            <BlockStack gap="200">
              <InlineStack gap="200" align="start">
                <Text variant="bodyMd" fontWeight="semibold" as="span">
                  {orderNumber}
                </Text>
                <Text variant="bodySm" as="span" tone="subdued">
                  {date}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  {customer}
                </Text>
                <Text as="span" variant="bodyMd" alignment="end">
                  {total}
                </Text>
              </InlineStack>
              <InlineStack gap="200">
                {paymentStatus === 'Paid' ? (
                  <Badge progress={paymentProgress}>{paymentStatus}</Badge>
                ) : (
                  <Badge tone="warning" progress={paymentProgress}>
                    {paymentStatus}
                  </Badge>
                )}
                {fulfillmentStatus === 'Unfulfilled' ? (
                  <Badge tone="attention" progress={fulfillmentProgress}>
                    {fulfillmentStatus}
                  </Badge>
                ) : (
                  <Badge progress={fulfillmentProgress}>{fulfillmentStatus}</Badge>
                )}
              </InlineStack>
              <BlockStack gap="100">
                <Text as="span" variant="bodySm" tone="subdued">
                  Delivery: {deliveryMethod}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  Channel: {channels || 'N/A'}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  Items: {Array.isArray(items) ? items.join(', ') : items || 'N/A'}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  Tags: {tags.length > 0 ? tags.join(', ') : 'N/A'}
                </Text>
              </BlockStack>
            </BlockStack>
          </div>
        ) : (
          <>
            <IndexTable.Cell>
            {console.log(properties,'properties')}
             <Text variant="bodyMd" fontWeight="semibold" as="span" textDecorationLine={refunds?"line-through":"none"}>
          {orderNumber}
        </Text>
            </IndexTable.Cell>
            <IndexTable.Cell><Text textDecorationLine={refunds?"line-through":"none"}>{date}</Text></IndexTable.Cell>
            <IndexTable.Cell ><Text textDecorationLine={refunds?"line-through":"none"}>{customer}</Text></IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" textDecorationLine={refunds?"line-through":"none"} numeric>
                {total}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              {paymentStatus === 'Paid' ? (
                <Badge progress={paymentProgress}>{paymentStatus}</Badge>
              ) : (
                <Badge tone="warning" progress={paymentProgress}>
                  {paymentStatus}
                </Badge>
              )}
            </IndexTable.Cell>
            <IndexTable.Cell>
              {fulfillmentStatus === 'Unfulfilled' ? (
                <Badge tone="attention" progress={fulfillmentProgress}>
                  {fulfillmentStatus}
                </Badge>
              ) : (
                <Badge progress={fulfillmentProgress}>{fulfillmentStatus}</Badge>
              )}
            </IndexTable.Cell>
            <IndexTable.Cell><Text textDecorationLine={refunds?"line-through":"none"}>{deliveryMethod}</Text></IndexTable.Cell>
            <IndexTable.Cell><Text textDecorationLine={refunds?"line-through":"none"}>{channels || ' '}</Text></IndexTable.Cell>
            <IndexTable.Cell>{Array.isArray(items) ? items.join(', ') : items || ' '}</IndexTable.Cell>
            <IndexTable.Cell>{tags.length > 0 ? tags.join(', ') : ' '}</IndexTable.Cell>
          </>
        )}
      </IndexTable.Row>
    ),
  );
  return (
    <>
      <Page
        fullWidth
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon source={OrderIcon} />
            <Text variant="headingLg" as="h5">
              Orders
            </Text>
          </div>
        }
        primaryAction={<Button onClick={() => setExportModalOpen(true)} variant="primary">Export</Button>}
      >
        {!loading ? <LegacyCard>
          <Box paddingBlockEnd="400">
            <IndexFilters
              sortOptions={sortOptions}
              sortSelected={sortSelected}
              queryValue={queryValue}
              clearButton
              queryPlaceholder="Searching in all"
              onQueryChange={setQueryValue}
              onQueryClear={() => setQueryValue('')}
              onSort={setSortSelected}
              tabs={viewTabs}
              selected={selected}
              onSelect={setSelected}
              filters={[]}
              cancelAction={{
                onAction: onHandleCancel,
                disabled: false,
                loading: false,
              }}
              appliedFilters={[]}
              onClearAll={() => setQueryValue('')}
              mode={mode}
              setMode={setMode}
            />
            <IndexTable
              condensed={condensed}
              resourceName={{ singular: 'order', plural: 'orders' }}
              itemCount={paginatedOrders.length}
              selectedItemsCount={selectedResources.filter(id => paginatedOrders.some(o => o.id === id)).length}
              allResourcesSelected={allResourcesSelected}
              onSelectionChange={handleSelectionChange}
              promotedBulkActions={promotedBulkActions}
              headings={[
                { title: 'Order' },
                { title: 'Date' },
                { title: 'Customer' },
                { title: 'Total' },
                { title: 'Payment status' },
                { title: 'Fulfillment status' },
                { title: 'Delivery method' },
                { title: 'Channel' },
                { title: 'Items' },
                { title: 'Tags' },
              ]}
              pagination={{
                hasPrevious: currentPage > 1,
                hasNext: currentPage * pageSize < filteredOrders.length,
                onPrevious: () => setCurrentPage((prev) => Math.max(prev - 1, 1)),
                onNext: () => setCurrentPage((prev) => prev + 1),
                label: paginationLabel,
              }}
            >
              {rowMarkup}
            </IndexTable>
          </Box>
        </LegacyCard>
      : 
      <InlineStack align='center'><Spinner accessibilityLabel="Spinner example" size="large" />  </InlineStack>
      }
        {toastMarkup}
      </Page>

      {/* Export Modal */}
      <Modal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Orders"
        primaryAction={{
          content: 'Export',
          onAction: () => handleExport(),
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setExportModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <div style={{ paddingBlockEnd: '8px' }}>
            <Text variant="headingSm" as="h6">
              Export
            </Text>
          </div>

          <BlockStack gap="200">
            <RadioButton
              label="Order Export By date range"
              checked={exportOption === 'dateRange'}
              onChange={() => {
                setExportOption('dateRange');
                setSelectedDates({ start: new Date(), end: new Date() });
              }}
            />
            {exportOption === 'dateRange' && (
              <DatePicker
                month={month}
                year={year}
                onChange={setSelectedDates}
                onMonthChange={handleMonthChange}
                selected={selectedDates}
                multiMonth
                allowRange
                disableDatesAfter={new Date()}
              />
            )}

            <RadioButton
              label="Order Export By Time range on a specific date"
              checked={exportOption === 'timeRange'}
              onChange={() => {
                setExportOption('timeRange');
                setSelectedDate(new Date());
              }}
            />
            {exportOption === 'timeRange' && (
              <BlockStack gap="400">
                <DatePicker
                  month={month}
                  year={year}
                  onChange={({ start }) => setSelectedDate(start)}
                  onMonthChange={handleMonthChange}
                  selected={selectedDate}
                  allowRange={false}
                  disableDatesAfter={new Date()}
                />
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="bold">Start time</Text>
                  <InlineGrid columns={2} gap="400">
                    <Select
                      label="Hour"
                      options={hourOptions}
                      value={startHour}
                      onChange={setStartHour}
                    />
                    <Select
                      label="Minute"
                      options={minuteOptions}
                      value={startMinute}
                      onChange={setStartMinute}
                    />
                  </InlineGrid>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="bold">End time</Text>
                  <InlineGrid columns={2} gap="400">
                    <Select
                      label="Hour"
                      options={hourOptions}
                      value={endHour}
                      onChange={setEndHour}
                    />
                    <Select
                      label="Minute"
                      options={minuteOptions}
                      value={endMinute}
                      onChange={setEndMinute}
                    />
                  </InlineGrid>
                </BlockStack>
                {timeError && (
                  <InlineError
                    message="End time must be after start time"
                    fieldID="time-error"
                  />
                )}
              </BlockStack>
            )}
          </BlockStack>
        </Modal.Section>
        {filteredOrders.length === 0 && (
          <Modal.Section>
            <InlineError
              message="No orders match the selected filters."
              fieldID="order-export-error"
            />
          </Modal.Section>
        )}
      </Modal>
    </>
  );

  // Helpers
  function parseOrderDate(dateStr) {
    try {
      if (dateStr instanceof Date) return dateStr;
      const maybeISO = new Date(dateStr);
      if (!isNaN(maybeISO.getTime())) return maybeISO;
      const currentYear = new Date().getFullYear();
      let formatted = String(dateStr);
      if (formatted.includes(' at ')) {
        formatted = formatted.replace(' at ', ` ${currentYear} `);
      }
      if (!/\d{4}/.test(formatted)) {
        formatted = `${formatted} ${currentYear}`;
      }
      const parsed = new Date(formatted);
      if (isNaN(parsed.getTime())) return new Date(0);
      return parsed;
    } catch {
      return new Date(0);
    }
  }
}

export default OrderManagement;