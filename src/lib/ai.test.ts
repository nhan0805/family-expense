import {describe,expect,it} from 'vitest';import {aiResponseSchema,dashboardSummaryResponseSchema,transactionSearchResponseSchema} from './ai';
const base={date:'2026-08-25',description:'Mua sữa',amount:450000,transactionType:'Chi tiêu',status:'Thực tế',purposeId:null,purposeName:'Con cái',expenseTypeId:null,expenseTypeName:'Thực phẩm',paymentMethodId:null,paymentMethodName:'Thẻ tín dụng',confidence:.95,warnings:[]};
describe('Gemini structured response',()=>{it('nhận JSON hợp lệ',()=>expect(aiResponseSchema.parse({suggestion:base}).suggestion.amount).toBe(450000));it('nhận thiếu amount có cảnh báo',()=>expect(aiResponseSchema.parse({suggestion:{...base,amount:null,warnings:['Thiếu số tiền']}}).suggestion.amount).toBeNull());it('từ chối JSON lỗi',()=>expect(()=>aiResponseSchema.parse({suggestion:{...base,confidence:2}})).toThrow());it('từ chối danh mục sai kiểu',()=>expect(()=>aiResponseSchema.parse({suggestion:{...base,purposeId:12}})).toThrow())});

describe('AI dashboard và tìm kiếm',()=>{
  const filters={query:'',semanticQuery:'sữa cho con',transactionType:'Chi tiêu' as const,status:'Thực tế' as const,purposeIds:['11111111-1111-4111-8111-111111111111'],expenseTypeIds:['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'],paymentMethodIds:[],amountMin:500000,amountMax:2000000,month:8,year:2026,dateFrom:null,dateTo:null,sort:'date-desc' as const};
  it('nhận bộ lọc tìm kiếm có cấu trúc và nhiều danh mục',()=>expect(transactionSearchResponseSchema.parse({filters,explanation:'Đã lọc chi tiêu tháng 8'}).filters.expenseTypeIds).toHaveLength(2));
  it('nhận bộ lọc khoảng số tiền',()=>expect(transactionSearchResponseSchema.parse({filters,explanation:'Đã lọc từ 500 nghìn đến 2 triệu'}).filters.amountMin).toBe(500000));
  it('từ chối ID danh mục không phải UUID',()=>expect(()=>transactionSearchResponseSchema.parse({filters:{...filters,purposeIds:['p1']},explanation:''})).toThrow());
  it('nhận tóm tắt Dashboard và tối đa bốn điểm',()=>expect(dashboardSummaryResponseSchema.parse({summary:'Chi tiêu ổn định.',highlights:['Ăn uống là nhóm lớn nhất']}).highlights).toHaveLength(1));
  it('từ chối tóm tắt rỗng',()=>expect(()=>dashboardSummaryResponseSchema.parse({summary:'',highlights:[]})).toThrow());
});
